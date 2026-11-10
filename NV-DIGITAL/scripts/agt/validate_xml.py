#!/usr/bin/env python3
"""Validação local offline do XML de ensaio. Nenhum envio à AGT."""
import sys, json, hashlib
from pathlib import Path
try:
    from lxml import etree
except ImportError:
    print(json.dumps({"valid":False,"available":False,"errors":["Instale lxml: python3 -m pip install -r scripts/agt/requirements.txt"]}));sys.exit(3)
try:
    raw=sys.stdin.buffer.read(25_000_001)
    if len(raw)>25_000_000 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():raise ValueError("XML excede o limite ou contém DTD/entidades proibidas")
    schema_path=Path(__file__).resolve().parents[2]/'resources/agt/SAFTAO1.01_01.xsd'
    schema_bytes=schema_path.read_bytes()
    if hashlib.sha256(schema_bytes).hexdigest()!='e9a938e1f47ac3d84ffbb26d0d95b827fc769a065c9d20533d0262c12f8c2631':raise ValueError("O XSD não corresponde à versão verificada")
    parser=etree.XMLParser(resolve_entities=False,no_network=True,load_dtd=False,huge_tree=False)
    schema=etree.XMLSchema(etree.fromstring(schema_bytes,parser))
    doc=etree.fromstring(raw,parser)
    valid=schema.validate(doc)
    print(json.dumps({"valid":valid,"available":True,"schema":"SAF-T(AO) 1.01_01","schemaSha256":hashlib.sha256(schema_bytes).hexdigest(),"errors":[str(e) for e in list(schema.error_log)[:30]]},ensure_ascii=False))
    sys.exit(0 if valid else 2)
except Exception as e:
    print(json.dumps({"valid":False,"available":True,"errors":[str(e)]},ensure_ascii=False));sys.exit(2)
