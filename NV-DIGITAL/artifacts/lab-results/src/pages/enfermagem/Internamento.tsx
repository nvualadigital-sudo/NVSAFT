import Enfermagem from "./Enfermagem";
import type { Session } from "../../store/auth";
export default function Internamento({ session }: { session?: Session }) {
  return (
    <>
      <h1 className="px-5 pt-5 text-xl font-bold">Internamento</h1>
      <Enfermagem session={session} />
    </>
  );
}
