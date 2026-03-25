import { PrismaClient } from '@prisma/client'

// Create a single Prisma instance for the whole app
// Why single instance? Because database connections are expensive
// Creating a new connection for every request would be very slow
const prisma = new PrismaClient({
  log: ['error', 'warn'], // remove 'query' to stop showing SQL
})

export default prisma