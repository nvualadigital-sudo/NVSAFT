#!/usr/bin/env python3
"""Actualizar o NV-DIGITAL para a edição Netlify sem sobrescrever versões desconhecidas."""
import argparse
import hashlib
import json
import os
import stat
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

RELEASE = Path(__file__).resolve().parent
SOURCE = RELEASE / "NV-DIGITAL"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(root, name):
    rel = PurePosixPath(name)
    if rel.is_absolute() or ".." in rel.parts or rel.as_posix() != name:
        raise ValueError(f"Caminho inválido: {name}")
    path = root
    for part in rel.parts:
        path /= part
        if path.is_symlink():
            raise ValueError(f"Ligação simbólica no caminho: {name}")
    return path


def write_atomic(path, data, mode):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".nv-release-")
    try:
        with os.fdopen(fd, "wb") as file:
            file.write(data)
            os.fchmod(file.fileno(), mode)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def plan_update(root, consolidated=False, netlify=False, laboratory=False):
    manifest = json.loads((RELEASE / "versoes.json").read_text())
    if netlify or laboratory:
        p = safe_path(root, "nv-release.json")
        if not p.is_file() or digest(p.read_bytes()) not in [manifest["nv-release.json"]["release"], *manifest["nv-release.json"]["accepted"]]:
            raise ValueError("A edição Netlify anterior não foi reconhecida. Execute a simulação sem --sobre-netlify.")
        version = json.loads(p.read_text()).get("version", "")
        recognised = ("2026.11.03-netlify.2", "2026.11.05-netlify.3", "2026.11.05-netlify.4", "2026.11.05-netlify.5", "2026.11.05-netlify.6", "2026.11.05-netlify.7", "2026.11.05-netlify.8", "2026.11.05-netlify.9") if laboratory else ("2026.11.03-netlify.1", "2026.11.03-netlify.2", "2026.11.05-netlify.3", "2026.11.05-netlify.4", "2026.11.05-netlify.5", "2026.11.05-netlify.6", "2026.11.05-netlify.7", "2026.11.05-netlify.8", "2026.11.05-netlify.9")
        if version not in recognised:
            raise ValueError("Use --sobre-netlify apenas se já instalou a edição Netlify. Para outra base, execute a simulação sem esse argumento.")
    if consolidated:
        # Use the smaller delta only on an already consolidated codebase.
        for name in ("migrations/20261029_enfermagem_integrada.sql", "migrations/20261029_rh_descontos_configuraveis.sql"):
            p = safe_path(root, name)
            if not p.is_file() or digest(p.read_bytes()) != manifest[name]["release"]:
                raise ValueError("A instalação consolidada não foi confirmada. Execute a simulação sem --sobre-consolidado.")
    plan, conflicts = [], []
    for name, entry in manifest.items():
        if consolidated and not entry["desde_consolidado"]:
            continue
        if netlify and not entry["desde_netlify"]:
            continue
        if laboratory and not entry["desde_laboratorio"]:
            continue
        incoming = safe_path(SOURCE, name).read_bytes() if entry["release"] is not None else None
        if incoming is not None and digest(incoming) != entry["release"]:
            raise ValueError(f"Pacote incompleto ou alterado: {name}")
        target = safe_path(root, name)
        before = target.read_bytes() if target.exists() else None
        local = digest(before) if before is not None else None
        if local == entry["release"]:
            continue
        if local not in entry["accepted"]:
            conflicts.append(name)
            continue
        previous_mode = stat.S_IMODE(target.stat().st_mode) if before is not None else None
        plan.append((name, target, before, previous_mode, incoming, entry["mode"]))
    if conflicts:
        paths = "\n".join(f"  {name}" for name in conflicts)
        raise ValueError(f"Ficheiros fora das versões reconhecidas. Nenhum foi alterado.\n{paths}")
    return plan


def apply_update(root, plan):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    backup = safe_path(root, f"backups/nv-netlify-{stamp}")
    backup.mkdir(parents=True, exist_ok=False)
    for name, _, before, mode, _, _ in plan:
        if before is not None:
            write_atomic(backup / "originais" / name, before, mode)
    metadata = [{"path": name, "created": before is None, "removed": incoming is None} for name, _, before, _, incoming, _ in plan]
    (backup / "alteracoes.json").write_text(json.dumps(metadata, indent=2) + "\n")
    changed = []
    try:
        for name, path, before, mode, incoming, new_mode in plan:
            safe_path(root, name)
            current = path.read_bytes() if path.exists() else None
            if current != before:
                raise ValueError(f"O ficheiro mudou durante a actualização: {name}")
            if incoming is None:
                path.unlink()
            else:
                write_atomic(path, incoming, new_mode)
            changed.append((path, before, mode))
    except BaseException:
        for path, before, mode in reversed(changed):
            if before is None:
                path.unlink()
            else:
                write_atomic(path, before, mode)
        raise
    print(f"Actualizados {len(plan)} ficheiros. Cópia anterior: {backup.relative_to(root)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    parser.add_argument("--check", action="store_true", help="verificar sem escrever")
    base = parser.add_mutually_exclusive_group()
    base.add_argument("--sobre-consolidado", action="store_true", help="aplicar apenas a diferença se já usa o consolidado de 03/11/2026")
    base.add_argument("--sobre-netlify", action="store_true", help="actualizar a partir da primeira edição Netlify")
    base.add_argument("--sobre-laboratorio", action="store_true", help="aplicar apenas as correcções posteriores à edição Laboratório (.2)")
    args = parser.parse_args()
    root = args.project.resolve()
    for name in ("package.json", "artifacts/api-server/src/routes/index.ts", "pnpm-workspace.yaml"):
        if not safe_path(root, name).is_file():
            raise ValueError("Indique a raiz existente do NV-DIGITAL.")
    if args.check:
        plan = plan_update(root, args.sobre_consolidado, args.sobre_netlify, args.sobre_laboratorio)
        for name, _, _, _, incoming, _ in plan:
            print(("Retirar componente duplicado: " if incoming is None else "Actualizar: ") + name)
        print(f"Simulação concluída: {len(plan)} ficheiros a actualizar.")
        return
    lock = safe_path(root, ".nv-actualizacao.lock")
    fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(fd)
    try:
        plan = plan_update(root, args.sobre_consolidado, args.sobre_netlify, args.sobre_laboratorio)
        if plan:
            apply_update(root, plan)
        else:
            print("Esta versão já está instalada.")
    finally:
        lock.unlink()


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
