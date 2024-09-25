<template>
  <PageContent page-title="Equipment management">
    <template #actions>
      <PerdMenu
        icon="tabler:link"
        text="Manage"
      >
        <OptionButton
          icon="tabler:plus"
          @click="handleAddItemClick"
        >
          Add item
        </OptionButton>

        <OptionButton
          icon="tabler:filters"
          @click="handleTypesClick"
        >
          Types
        </OptionButton>

        <OptionButton
          icon="tabler:category"
          @click="handleGroupsClick"
        >
          Groups
        </OptionButton>

        <OptionButton
          icon="tabler:wheelchair"
          @click="handleOldFormClick"
        >
          Old form
        </OptionButton>
      </PerdMenu>
    </template>

    <ol>
      <li v-for="item in equipment" :key="item.id">
        {{ item.name }}
      </li>
    </ol>
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdMenu from '~/components/PerdMenu.vue'
  import OptionButton from '~/components/PerdMenu/OptionButton.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const router = useRouter()

  const { data: equipment } = await useFetch('/api/equipment', {
    params: {
      searchString: '_'
    },

    transform: (data) => {
      return data.map((item) => {
        return {
          id: item.id,
          name: item.name
        }
      })
    }
  })

  function handleAddItemClick() {
    router.push('/manager/equipment/add')
  }

  function handleOldFormClick() {
    router.push('/manager/equipment/_add')
  }

  function handleTypesClick() {
    router.push('/manager/equipment/types')
  }

  function handleGroupsClick() {
    router.push('/manager/equipment/groups')
  }
</script>
