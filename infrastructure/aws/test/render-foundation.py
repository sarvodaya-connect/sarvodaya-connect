#!/usr/bin/env python3
"""Render deployment files offline; bootstrap must finish before foundation review."""
import argparse
import re
from pathlib import Path
import sys

parser = argparse.ArgumentParser(description=__doc__)
mode = parser.add_mutually_exclusive_group()
mode.add_argument('--bootstrap', action='store_true', help='Render the separate encrypted-parameter bootstrap stack')
mode.add_argument('--retained-import', action='store_true', help='Render only the two retained buckets and pool for a reviewed recovery IMPORT')
args = parser.parse_args()
root = Path(__file__).resolve().parent
source = (root / ('bootstrap.yaml' if args.bootstrap else 'foundation.yaml')).read_text()
marker = '        ZipFile: __PARAMETER_CODE__\n'
if args.bootstrap:
    if source.count(marker) != 1:
        raise SystemExit('Expected exactly one inline parameter handler marker')
    code = (root / 'secure-parameters.cjs').read_text()
    source = source.replace(marker, '        ZipFile: |\n' + ''.join('          ' + line + '\n' for line in code.splitlines()))
elif '__PARAMETER_CODE__' in source:
    raise SystemExit('The foundation must not generate its own prerequisite parameters')
if args.retained_import:
    # Preserve resource definitions byte-for-byte; never create a recovery copy
    # of the database/network or weaken a retained resource's safeguards.
    header, resources = source.split('Resources:\n', 1)
    resources = resources.split('Outputs:\n', 1)[0]
    blocks = re.split(r'(?=^  [A-Za-z0-9]+:\n)', resources, flags=re.MULTILINE)
    selected = [block for block in blocks if block.split(':', 1)[0].strip() in {'Documents', 'Artifacts', 'UserPool'}]
    if len(selected) != 3:
        raise SystemExit('Expected exactly three retained resources for recovery import')
    start, end = header.index('  NatImage:\n'), header.index('  DashboardOrigin:\n')
    header = header[:start] + header[end:]
    header = re.sub(r'^Description:.*$', 'Description: Sarvodaya Connect retained-resource IMPORT only; requires approved recovery plan', header, count=1, flags=re.MULTILINE)
    source = header + 'Resources:\n' + ''.join(selected)
sys.stdout.write(source)
