import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast !rounded-lg !border !border-white/10 !bg-[oklch(0.16_0.01_250)/0.92] !text-foreground !shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl",
          title: "!text-foreground !text-[13px] !font-semibold",
          description: "!text-muted-foreground !text-[12px]",
          actionButton:
            "!bg-primary !text-primary-foreground !text-[11px] !font-semibold !px-2 !py-1 !rounded",
          cancelButton: "!bg-white/10 !text-foreground !text-[11px] !rounded",
          success:
            "!border-emerald-500/40 !bg-emerald-500/[0.12] !text-emerald-100",
          error: "!border-rose-500/40 !bg-rose-500/[0.12] !text-rose-100",
          warning: "!border-amber-500/40 !bg-amber-500/[0.12] !text-amber-100",
          info: "!border-sky-500/40 !bg-sky-500/[0.10] !text-sky-100",
          closeButton:
            "!bg-white/10 !text-foreground !border-white/10 hover:!bg-white/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
