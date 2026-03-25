import { Router, Request, Response } from 'express'
import Stripe from 'stripe'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
})

const router = Router()

// ── TIER CONFIG ──
const TIER_MAP: Record<string, 'PRO' | 'PREMIUM'> = {
  [process.env.STRIPE_PRO_PRICE_ID     || '']: 'PRO',
  [process.env.STRIPE_PREMIUM_PRICE_ID || '']: 'PREMIUM',
}

// ── GENERATE INVITE CODE ──
function generateCode(tier: string): string {
  const prefix = tier === 'PRO' ? 'PRO' : 'PREM'
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${random}`
}

// ── CREATE CHECKOUT SESSION ──
// POST /stripe/checkout
// Frontend calls this to start a Stripe checkout
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { priceId } = req.body

    if (!priceId) {
      res.status(400).json({ error: 'Price ID required' })
      return
    }

    // Verify price ID is one of ours
    const tier = TIER_MAP[priceId]
    if (!tier) {
      res.status(400).json({ error: 'Invalid price ID' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  user.name,
        metadata: { userId: user.id },
      })
      customerId = customer.id

      await prisma.user.update({
        where: { id: user.id },
        data:  { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/dashboard?upgraded=true`,
      cancel_url:  `${process.env.CLIENT_URL}/pricing`,
      metadata: {
        userId: user.id,
        tier,
      },
    })

    res.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    res.status(500).json({ error: error.message })
  }
})

// ── STRIPE WEBHOOK ──
// POST /stripe/webhook
// Stripe calls this after payment succeeds
// IMPORTANT: must use raw body, not parsed JSON
router.post('/webhook', async (req: Request, res: Response) => {
  const sig         = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    res.status(400).json({ error: err.message })
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId  = session.metadata?.userId
    const tier    = session.metadata?.tier as 'PRO' | 'PREMIUM'

    console.log(`💳 Payment received — userId: ${userId}, tier: ${tier}`)

    if (!userId || !tier) {
      console.error('❌ Missing metadata in session:', session.metadata)
      res.json({ received: true })
      return
    }

    try {
      const code      = generateCode(tier)
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)

      await prisma.inviteCode.create({
        data: {
          code,
          tier,
          createdBy:       'stripe',
          stripePaymentId: session.id,
          expiresAt,
        }
      })

      await prisma.user.update({
        where: { id: userId },
        data:  { tier, tierExpiresAt: expiresAt }
      })

      console.log(`✅ User ${userId} upgraded to ${tier} — code: ${code}`)
    } catch (err) {
      console.error('❌ Error upgrading user:', err)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub        = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId }
    })

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data:  { tier: 'FREE', tierExpiresAt: null }
      })
      console.log(`⬇️  ${user.email} downgraded to FREE`)
    }
  }

  res.json({ received: true })
})

// ── GET PRICING INFO ──
// GET /stripe/prices
// Returns price info for the frontend pricing page
router.get('/prices', async (req: Request, res: Response) => {
  try {
    res.json({
      prices: [
        {
          id:       process.env.STRIPE_PRO_PRICE_ID,
          tier:     'PRO',
          name:     'GetHiredASAP Pro',
          amount:   900,   // cents
          currency: 'usd',
          interval: 'month',
          features: [
            'Auto-alerts every 15 minutes',
            'Up to 5 job searches',
            'NLP resume matching',
            'Early career detection',
            'Salary extraction',
            'Top matches history',
          ],
        },
        {
          id:       process.env.STRIPE_PREMIUM_PRICE_ID,
          tier:     'PREMIUM',
          name:     'GetHiredASAP Premium',
          amount:   1900,  // cents
          currency: 'usd',
          interval: 'month',
          features: [
            'Auto-alerts every 5 minutes',
            'Unlimited job searches',
            'Priority NLP scoring',
            'Early career detection',
            'Salary extraction',
            'Top matches history',
            'Email alerts',
            'Priority support',
          ],
        },
      ]
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// ── REDEEM INVITE CODE ──
// POST /stripe/redeem
// User enters invite code to activate their tier
router.post('/redeem', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      res.status(400).json({ error: 'Code required' })
      return
    }

    // Find the invite code
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code: code.toUpperCase().trim() }
    })

    if (!inviteCode) {
      res.status(404).json({ error: 'Invalid invite code' })
      return
    }

    if (inviteCode.usedAt) {
      res.status(409).json({ error: 'Code already used' })
      return
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      res.status(410).json({ error: 'Code expired' })
      return
    }

    // Mark code as used
    await prisma.inviteCode.update({
      where: { code: inviteCode.code },
      data: {
        usedAt: new Date(),
        userId: req.user!.userId,
      }
    })

    // Upgrade user tier
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        tier:          inviteCode.tier,
        tierExpiresAt: inviteCode.expiresAt,
      }
    })

    res.json({
      message: `🎉 Upgraded to ${inviteCode.tier}!`,
      tier:    inviteCode.tier,
    })

  } catch (error: any) {
    console.error('Redeem error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router