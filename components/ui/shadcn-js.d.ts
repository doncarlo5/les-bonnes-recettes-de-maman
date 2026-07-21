declare module "@/components/ui/alert" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Alert(
    props: ComponentPropsWithoutRef<"div"> & {
      variant?: "default" | "destructive";
    },
  ): React.ReactElement;
  export function AlertTitle(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
  export function AlertDescription(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
}

declare module "@/components/ui/badge" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Badge(
    props: ComponentPropsWithoutRef<"span"> & {
      variant?: "default" | "secondary" | "destructive" | "outline";
    },
  ): React.ReactElement;
}

declare module "@/components/ui/button" {
  import type { ComponentPropsWithoutRef } from "react";

  type ButtonVariant =
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | "link";
  type ButtonSize =
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg";

  export function Button(
    props: ComponentPropsWithoutRef<"button"> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    },
  ): React.ReactElement;

  export function buttonVariants(props?: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
  }): string;
}

declare module "@/components/ui/button-group" {
  import type { ComponentPropsWithoutRef } from "react";

  export function ButtonGroup(
    props: ComponentPropsWithoutRef<"div"> & {
      orientation?: "horizontal" | "vertical";
    },
  ): React.ReactElement;
}

declare module "@/components/ui/field" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Field(
    props: ComponentPropsWithoutRef<"div"> & {
      orientation?: "vertical" | "horizontal" | "responsive";
    },
  ): React.ReactElement;
  export function FieldLabel(
    props: ComponentPropsWithoutRef<"label">,
  ): React.ReactElement;
  export function FieldDescription(
    props: ComponentPropsWithoutRef<"p">,
  ): React.ReactElement;
  export function FieldError(
    props: ComponentPropsWithoutRef<"div"> & {
      errors?: { message?: string }[];
    },
  ): React.ReactElement | null;
  export function FieldGroup(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
  export function FieldSet(
    props: ComponentPropsWithoutRef<"fieldset">,
  ): React.ReactElement;
  export function FieldTitle(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
}

declare module "@/components/ui/input" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Input(
    props: ComponentPropsWithoutRef<"input">,
  ): React.ReactElement;
}

declare module "@/components/ui/select" {
  import type { ComponentPropsWithoutRef, ReactNode } from "react";

  export function Select(props: {
    children?: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }): React.ReactElement;
  export function SelectContent(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
  export function SelectGroup(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
  export function SelectItem(
    props: ComponentPropsWithoutRef<"div"> & {
      value: string;
    },
  ): React.ReactElement;
  export function SelectTrigger(
    props: ComponentPropsWithoutRef<"button"> & {
      size?: "default" | "sm";
    },
  ): React.ReactElement;
  export function SelectValue(
    props: ComponentPropsWithoutRef<"span">,
  ): React.ReactElement;
}

declare module "@/components/ui/spinner" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Spinner(
    props: ComponentPropsWithoutRef<"svg">,
  ): React.ReactElement;
}

declare module "@/components/ui/table" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Table(
    props: ComponentPropsWithoutRef<"table">,
  ): React.ReactElement;
  export function TableHeader(
    props: ComponentPropsWithoutRef<"thead">,
  ): React.ReactElement;
  export function TableBody(
    props: ComponentPropsWithoutRef<"tbody">,
  ): React.ReactElement;
  export function TableHead(
    props: ComponentPropsWithoutRef<"th">,
  ): React.ReactElement;
  export function TableRow(
    props: ComponentPropsWithoutRef<"tr">,
  ): React.ReactElement;
  export function TableCell(
    props: ComponentPropsWithoutRef<"td">,
  ): React.ReactElement;
}

declare module "@/components/ui/tabs" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Tabs(
    props: ComponentPropsWithoutRef<"div"> & {
      defaultValue?: string;
      value?: string;
      onValueChange?: (value: string) => void;
    },
  ): React.ReactElement;
  export function TabsList(
    props: ComponentPropsWithoutRef<"div">,
  ): React.ReactElement;
  export function TabsTrigger(
    props: ComponentPropsWithoutRef<"button"> & {
      value: string;
    },
  ): React.ReactElement;
  export function TabsContent(
    props: ComponentPropsWithoutRef<"div"> & {
      value: string;
    },
  ): React.ReactElement;
}

declare module "@/components/ui/textarea" {
  import type { ComponentPropsWithoutRef } from "react";

  export function Textarea(
    props: ComponentPropsWithoutRef<"textarea">,
  ): React.ReactElement;
}
