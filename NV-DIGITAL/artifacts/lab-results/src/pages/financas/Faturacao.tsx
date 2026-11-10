import BillingModule from "../../modules/faturacao/Module";
export default function Faturacao({
  onNav,
}: {
  session?: any;
  onNav?: (tab: string) => void;
}) {
  return <BillingModule onNavigate={onNav} />;
}
