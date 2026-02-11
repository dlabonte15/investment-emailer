import toast from "react-hot-toast";

export const showSuccess = (message: string) =>
  toast.success(message, { duration: 3000 });

export const showError = (message: string) =>
  toast.error(message, { duration: 5000 });

export const showLoading = (message: string) =>
  toast.loading(message);

export const dismiss = (id?: string) =>
  id ? toast.dismiss(id) : toast.dismiss();
