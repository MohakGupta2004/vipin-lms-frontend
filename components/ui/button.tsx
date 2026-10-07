import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-colors duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-orange-hover",
        lime: "bg-secondary text-navy hover:bg-lime-hover",
        navy: "bg-brand-blue text-white hover:bg-brand-blue-dark",
        outline:
          "border-heading/30 bg-white text-heading hover:border-teal hover:bg-accent aria-expanded:bg-accent",
        outlineLight:
          "border-white/60 bg-transparent text-white hover:bg-white hover:text-navy",
        secondary: "bg-secondary text-navy hover:bg-lime-hover",
        ghost: "text-heading hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent",
        destructive:
          "border-destructive/30 bg-white text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
        link: "px-0 text-teal underline underline-offset-4 hover:opacity-80",
      },
      size: {
        default: "h-10 gap-2 px-5",
        xs: "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-[15px]",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
