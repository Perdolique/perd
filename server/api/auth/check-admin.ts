interface ReturnData {
  readonly isAdmin: boolean;
}

export default defineEventHandler(async (event) : Promise<ReturnData> => {
  const isAdmin = await checkAdmin(event)

  return {
    isAdmin
  }
})
