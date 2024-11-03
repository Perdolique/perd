Do not use semicolons.

Semicolons should be used only in the interfaces.

`defineProps` should be destructured this way: `const { woof } = defineProps<Props>()`, but only for the props used below in the code or if props require default value like `const { woof = 'BARK' } = ...`.
