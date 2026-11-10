import Registos from "./Registos";
import type { Session } from "../../store/auth";
export default function PedidosCompra(_props: { session?: Session }) {
  return <Registos kind="purchases" />;
}
