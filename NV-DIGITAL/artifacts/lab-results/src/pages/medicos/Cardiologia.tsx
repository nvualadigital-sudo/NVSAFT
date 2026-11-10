import Medico from "./Medico";
import type { Session } from "../../store/auth";
export default function Cardiologia({ session }: { session?: Session }) {
  return <Medico session={session} specialty="Cardiologia" />;
}
