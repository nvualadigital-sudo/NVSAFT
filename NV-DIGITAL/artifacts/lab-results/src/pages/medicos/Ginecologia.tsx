import Medico from "./Medico";
import type { Session } from "../../store/auth";
export default function Ginecologia({ session }: { session?: Session }) {
  return <Medico session={session} specialty="Ginecologia" />;
}
