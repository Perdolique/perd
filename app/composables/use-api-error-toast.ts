import { FetchError } from 'ofetch';

export default function useApiErrorToast() {
  const { addToast } = useToaster();

  function showErrorToast(error: unknown, title: string) {
    if (error instanceof FetchError) {
      addToast({
        title,
        message: error.data.message
      });
    } else {
      addToast({
        title,
        message: 'An unexpected error occurred'
      });
    }
  }

  return {
    showErrorToast
  };
}
