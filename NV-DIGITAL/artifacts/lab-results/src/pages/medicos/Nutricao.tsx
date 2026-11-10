import Medico from "./Medico";
import type { Session } from "../../store/auth";
export default function Nutricao({ session }: { session?: Session }) {
  return <Medico session={session} specialty="Nutrição" />;
}
