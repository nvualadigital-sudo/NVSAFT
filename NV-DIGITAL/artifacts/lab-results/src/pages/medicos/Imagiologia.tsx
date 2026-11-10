import Registos from "../financas/Registos";
import type { Session } from "../../store/auth";
export default function Imagiologia(_props: { session?: Session }) {
  return <Registos kind="imaging" />;
}
