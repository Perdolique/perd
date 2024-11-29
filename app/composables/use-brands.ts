import type { BrandModel } from "~/models/brand";

interface Meta {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

export default async function useBrands() {
  const brands = useState<BrandModel[]>('brands', () => [])

  const meta = useState<Meta>('brands-meta', () => ({
    limit: 0,
    offset: 0,
    total: 0
  }))

  const page = useState('brands-page', () => 1)

  const { data, error, refresh } = await useFetch('/api/brands', {
    query: {
      page
    }
  })

  watch(data, (newData) => {
    if (newData !== undefined) {
      brands.value = newData.data
      meta.value = newData.meta
    }
  }, { immediate: true })

  return {
    brands,
    meta,
    page,
    error,
    refresh
  }
}
