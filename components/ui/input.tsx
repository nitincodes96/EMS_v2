import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "w-full h-12 rounded-full",
        "border border-gray-300 bg-white",
        "px-5",
        "text-sm text-gray-900 placeholder:text-gray-400",
        "transition-all duration-200",
        "outline-none",
        "focus:border-gray-500 focus:ring-4 focus:ring-gray-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-red-500 aria-invalid:ring-red-200",
        className
      )}
      {...props}
    />
  );
}

export { Input };