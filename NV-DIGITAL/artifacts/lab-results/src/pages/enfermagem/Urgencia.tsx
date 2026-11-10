import Enfermagem from "./Enfermagem";
import type { Session } from "../../store/auth";
export default function Urgencia({ session }: { session?: Session }) {
  return (
    <>
      <h1 className="px-5 pt-5 text-xl font-bold">Urgencia</h1>
      <Enfermagem session={session} />
    </>
  );
}
