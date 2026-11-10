import { useEffect, useId, useState } from "react";
import {
  ANGOLA_GEOGRAPHY,
  COUNTRIES,
  GEOGRAPHY_VERSION,
  emptyAddress,
  type GeoAddress,
  type PatientGeography,
} from "@workspace/api-zod";
import { hospitalApi } from "../../store/hospital";
const input =
  "w-full border border-border rounded-lg bg-background p-2 text-sm";
function AddressFields({
  title,
  value: a,
  onChange,
  canApprove,
}: {
  title: string;
  value: GeoAddress;
  onChange: (a: GeoAddress) => void;
  canApprove: boolean;
}) {
  const id = useId(),
    [localities, setLocalities] = useState<any[]>([]),
    [message, setMessage] = useState("");
  const p = ANGOLA_GEOGRAPHY.find((p) => p.id === a.provinceId),
    m = p?.municipalities.find((m) => m.id === a.municipalityId),
    parent = a.communeId || a.municipalityId;
  useEffect(() => {
    let live = true;
    setLocalities([]);
    if (parent)
      void hospitalApi<any[]>(
        "GET",
        "/geography/localities?parent=" + encodeURIComponent(parent),
      )
        .then((r) => {
          if (live) setLocalities(r);
        })
        .catch((e) => {
          if (live) setMessage(e.message);
        });
    return () => {
      live = false;
    };
  }, [parent]);
  const field = (key: keyof GeoAddress, label: string) => (
    <label className="block text-xs font-semibold">
      {label}
      <input
        className={input}
        value={a[key]}
        onChange={(e) => onChange({ ...a, [key]: e.target.value })}
      />
    </label>
  );
  async function propose() {
    try {
      const row = await hospitalApi<any>("POST", "/geography/localities", {
        parentId: parent,
        name: a.neighbourhood,
      });
      setLocalities((s) => [...s.filter((x) => x.id !== row.id), row]);
      setMessage(
        row.status === "approved"
          ? "Localidade já aprovada."
          : "Localidade proposta para revisão administrativa.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function approve(locality: any) {
    try {
      await hospitalApi(
        "POST",
        "/geography/localities/" + locality.id + "/approve",
      );
      setLocalities((s) =>
        s.map((x) => (x.id === locality.id ? { ...x, status: "approved" } : x)),
      );
      setMessage("Localidade aprovada para esta instituição.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <fieldset className="border border-border rounded-xl p-4 space-y-3">
      <legend className="text-sm font-bold px-2">{title}</legend>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-xs font-semibold">
          País
          <select
            className={input}
            value={a.country}
            onChange={(e) =>
              onChange({ ...emptyAddress(), country: e.target.value })
            }
          >
            {COUNTRIES.map((c) => (
              <option value={c.code} key={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {a.country === "AO" ? (
          <>
            <label className="text-xs font-semibold">
              Província
              <select
                className={input}
                value={a.provinceId}
                onChange={(e) =>
                  onChange({
                    ...a,
                    provinceId: e.target.value,
                    municipalityId: "",
                    communeId: "",
                    neighbourhood: "",
                    provinceName: "",
                    municipalityName: "",
                    communeName: "",
                  })
                }
              >
                <option value="">Seleccionar</option>
                {ANGOLA_GEOGRAPHY.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Município
              <select
                className={input}
                disabled={!p}
                value={a.municipalityId}
                onChange={(e) =>
                  onChange({
                    ...a,
                    municipalityId: e.target.value,
                    communeId: "",
                    neighbourhood: "",
                    municipalityName: "",
                    communeName: "",
                  })
                }
              >
                <option value="">Seleccionar</option>
                {p?.municipalities.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Comuna
              <select
                className={input}
                disabled={!m?.communes.length}
                value={a.communeId}
                onChange={(e) =>
                  onChange({
                    ...a,
                    communeId: e.target.value,
                    neighbourhood: "",
                    communeName: "",
                  })
                }
              >
                <option value="">
                  {m && !m.communes.length
                    ? "Sem comuna no quadro legal"
                    : "Seleccionar, quando aplicável"}
                </option>
                {m?.communes.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            {field("provinceName", "Província / região")}
            {field("municipalityName", "Município / cidade")}
            {field("communeName", "Subdivisão, quando aplicável")}
          </>
        )}
        <label className="text-xs font-semibold">
          Bairro / localidade
          <input
            className={input}
            list={id}
            value={a.neighbourhood}
            onChange={(e) => onChange({ ...a, neighbourhood: e.target.value })}
          />
          <datalist id={id}>
            {localities
              .filter((x) => x.status === "approved")
              .map((x) => (
                <option key={x.id} value={x.name} />
              ))}
          </datalist>
        </label>
        {field("street", "Rua")}
        {field("house", "Número / casa")}
        {field("reference", "Referência")}
      </div>
      {parent &&
        a.neighbourhood &&
        !localities.some(
          (x) => x.name === a.neighbourhood && x.status === "approved",
        ) && (
          <button
            type="button"
            className="text-xs underline"
            onClick={() => void propose()}
          >
            Propor bairro à revisão da instituição
          </button>
        )}
      {canApprove &&
        localities
          .filter((x) => x.status === "pending")
          .map((x) => (
            <div className="flex gap-2 text-xs" key={x.id}>
              <span>Por rever: {x.name}</span>
              <button
                type="button"
                className="underline"
                onClick={() => void approve(x)}
              >
                Aprovar localidade
              </button>
            </div>
          ))}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </fieldset>
  );
}
export default function PatientGeographyFields({
  value,
  onChange,
  canApprove = false,
}: {
  value: PatientGeography;
  onChange: (data: PatientGeography, addressChanged: boolean) => void;
  canApprove?: boolean;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-xs font-semibold">
        País de nacionalidade
        <select
          className={input}
          value={value.nationalityCountry}
          onChange={(e) =>
            onChange({ ...value, nationalityCountry: e.target.value }, false)
          }
        >
          {COUNTRIES.map((c) => (
            <option value={c.code} key={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <AddressFields
        title="Residência"
        value={value.residence}
        onChange={(a) => onChange({ ...value, residence: a }, true)}
        canApprove={canApprove}
      />
      <details>
        <summary className="text-sm font-semibold cursor-pointer">
          Naturalidade — local de nascimento
        </summary>
        <AddressFields
          title="Naturalidade"
          value={value.birthplace}
          onChange={(a) => onChange({ ...value, birthplace: a }, false)}
          canApprove={canApprove}
        />
      </details>
      <p className="text-xs text-muted-foreground">
        Angola: 21 províncias, 326 municípios e 378 comunas — Lei 14/24.
        Catálogo {GEOGRAPHY_VERSION}. Bairros propostos são revistos pela
        instituição; o catálogo não apresenta uma lista nacional completa de
        bairros.
      </p>
    </div>
  );
}
