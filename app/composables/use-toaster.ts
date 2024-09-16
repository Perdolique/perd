export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly title?: string;
  readonly duration?: number | null;
}

type ToastParams = Omit<Toast, 'id'>;

const defaultDuration = 5000;

export default function useToaster() {
  const toasts = useState<Toast[]>('toaster', () => []);

  function addToast({
    message,
    duration = defaultDuration,
    title
  } : ToastParams) {
    const id = Date.now();

    toasts.value.unshift({
      id,
      message,
      title,
      duration
    });
  }

  function removeToast(id: number) {
    const foundIndex = toasts.value.findIndex(toast => toast.id === id);

    if (foundIndex >= 0) {
      toasts.value.splice(foundIndex, 1);
    }
  }

  return {
    toasts,
    addToast,
    removeToast
  }
}
