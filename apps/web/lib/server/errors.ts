export function authErrorMessage(error: unknown) {
  if (!process.env.DATABASE_URL) {
    return 'DATABASE_URL is missing in Vercel environment variables'
  }

  if (error instanceof Error) {
    if (error.message.includes('Environment variable not found: DATABASE_URL')) {
      return 'DATABASE_URL is missing in Vercel environment variables'
    }

    if (error.message.includes("Can't reach database server")) {
      return 'Database server is unreachable from Vercel'
    }

    if (error.message.includes('does not exist in the current database')) {
      return 'Database schema is not migrated yet'
    }

    if (error.message.includes('Prisma Client could not locate the Query Engine')) {
      return 'Prisma Client was not generated during deployment'
    }
  }

  return 'Internal server error'
}
