import Medico from "./Medico";
import type { Session } from "../../store/auth";
export default function Receitas({ session }: { session?: Session }) {
  return <Medico session={session} specialty="Clínica Geral" />;
}
