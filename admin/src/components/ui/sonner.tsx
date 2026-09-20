import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** The toasts: one for every outcome, at the bottom right, with the app's colours. */
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    position="bottom-right"
    closeButton
    richColors
    toastOptions={{ classNames: { toast: 'font-sans' } }}
    {...props}
  />
);

export { Toaster };
