export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
  batch: string;
  section: string;
};

export type ThemeMode = "light" | "dark";
export type ToastKind = "success" | "error" | "info";

export type ToastState = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};
