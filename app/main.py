import json
import os
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Form, Request
from fastapi.responses import Response, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

# ─── Paths ──────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent          # repo root
APP_DIR  = Path(__file__).parent
COUNTER_FILE = BASE_DIR / "counter.json"
TEMPLATES_DIR = APP_DIR / "templates"
ASSETS_DIR   = BASE_DIR / "assets"

# ─── FastAPI app ────────────────────────────────────────────
app = FastAPI(title="Generador de Cuentas de Cobro")

app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
app.mount("/static", StaticFiles(directory=str(APP_DIR / "static")), name="static")

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# ─── Counter helpers ────────────────────────────────────────
def read_counter() -> int:
    if COUNTER_FILE.exists():
        with open(COUNTER_FILE, "r") as f:
            return json.load(f).get("counter", 1)
    return 1

def write_counter(value: int):
    with open(COUNTER_FILE, "w") as f:
        json.dump({"counter": value}, f)

def format_counter(n: int) -> str:
    return str(n).zfill(3)

# ─── Date helper ────────────────────────────────────────────
MONTHS_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

def fecha_hoy() -> str:
    hoy = datetime.now()
    return f"{hoy.day} de {MONTHS_ES[hoy.month]} de {hoy.year}"

# ─── Price presets ──────────────────────────────────────────
PRECIOS_COP = {
    "2000000": "2.000.000",
    "2500000": "2.500.000",
}

def format_price(valor: str, moneda: str) -> str:
    """Return a human-readable price string."""
    try:
        n = float(valor.replace(",", "."))
        if moneda == "COP":
            # Format with dots as thousands separator
            return f"${int(n):,}".replace(",", ".")
        else:  # USD
            return f"USD {n:,.2f}"
    except Exception:
        return valor

# ─── Routes ─────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    counter = read_counter()
    return templates.TemplateResponse("index.html", {
        "request": request,
        "next_numero": format_counter(counter),
        "fecha_hoy": fecha_hoy(),
    })

@app.post("/generar-pdf")
async def generar_pdf(
    razon_social: str = Form(...),
    nit: str = Form(...),
    servicio: str = Form(...),
    precio_opcion: str = Form(...),   # "2000000" | "2500000" | "libre"
    precio_libre: str = Form(""),
    moneda: str = Form("COP"),
):
    # Resolve the final price value
    if precio_opcion == "libre":
        valor_raw = precio_libre.strip() or "0"
    else:
        valor_raw = precio_opcion

    precio_display = format_price(valor_raw, moneda)

    # Invoice number
    counter = read_counter()
    numero  = format_counter(counter)

    # Render the HTML template with Jinja2
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    tmpl = env.get_template("factura_template.html")

    html_content = tmpl.render(
        numero=numero,
        fecha=fecha_hoy(),
        razon_social=razon_social,
        nit=nit,
        servicio=servicio,
        precio=precio_display,
        moneda=moneda,
        assets_path=str(ASSETS_DIR).replace("\\", "/"),
    )

    # Generate PDF with WeasyPrint
    pdf_bytes = HTML(
        string=html_content,
        base_url=str(BASE_DIR)
    ).write_pdf()

    # Increment counter AFTER successful generation
    write_counter(counter + 1)

    # Build a safe filename
    cliente_slug = razon_social.lower().replace(" ", "-").replace(".", "")
    filename = f"cuenta-de-cobro-{numero}-{cliente_slug}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.get("/current-number")
async def current_number():
    return {"numero": format_counter(read_counter())}
