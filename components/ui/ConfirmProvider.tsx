"use client";

import {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "@/components/ui/ConfirmDialog";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  "title" | "description" | "confirmLabel" | "cancelLabel"
>;

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolverRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options ? (
        <ConfirmDialog
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          onCancel={() => close(false)}
          onConfirm={() => close(true)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}
