import { desk } from "@/lib/ui/desk";

type DeskCardProps = {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
};

export function DeskCard({
  children,
  className = "",
  padding = true,
}: DeskCardProps) {
  return (
    <div className={`${desk.card} ${padding ? "p-6" : ""} ${className}`}>
      <div className={desk.bar} />
      <div className={desk.wash} />
      <div className="relative">{children}</div>
    </div>
  );
}
