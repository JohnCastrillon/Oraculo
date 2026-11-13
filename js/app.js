// URL pública de tu Web App desplegada en Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8TZSg-ntEjjGtdX7Ta-ZHpkaZ8a_ym73rEGTePHKJWW1Gk65WnLQuf2jhyO_WmPi5/exec";

// Variables globales para mantener las instancias de Chart.js y poder actualizarlas dinámicamente
let chartFlujoInstance = null;
let chartCategoriasInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  // 1. Detección y manejo de la vista Formulario (movimiento.html)
  const inputFecha = document.getElementById("fecha");
  if (inputFecha) {
    const today = new Date().toISOString().split("T")[0];
    inputFecha.value = today;
  }

  const gastoForm = document.getElementById("gastoForm");
  if (gastoForm) {
    gastoForm.addEventListener("submit", handleSubmitMovimiento);
  }

  // 2. Detección y manejo de la vista Dashboard (dasboard.html)
  const isDashboard = document.getElementById("flowChart") && document.getElementById("txt-ahorro");
  if (isDashboard) {
    cargarDatosDashboard();
  }
});

/* ==========================================================================
   LÓGICA DEL FORMULARIO DE REGISTRO (movimiento.html)
   ========================================================================== */

async function handleSubmitMovimiento(e) {
  e.preventDefault();

  const btnEnviar = document.getElementById("btnEnviar");
  const categoria = document.getElementById("categoria").value;
  const concepto  = document.getElementById("concepto").value.trim();
  const fecha     = document.getElementById("fecha").value;
  const importe   = document.getElementById("importe").value;

  if (!categoria || !concepto || !fecha || !importe) {
    mostrarFeedback("Por favor completa todos los campos requeridos.", "error");
    return;
  }

  const textoOriginal = btnEnviar.innerText;
  btnEnviar.disabled = true;
  btnEnviar.innerText = "Guardando en Sheets...";
  btnEnviar.style.opacity = "0.7";
  btnEnviar.style.cursor = "not-allowed";

  const payload = {
    categoria: categoria,
    concepto: concepto,
    fecha: fecha,
    importe: parseFloat(importe)
  };

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    mostrarFeedback("¡Movimiento registrado con éxito!", "success");
    document.getElementById("concepto").value = "";
    document.getElementById("importe").value = "";
    document.getElementById("concepto").focus();

  } catch (error) {
    console.error("Error al registrar movimiento:", error);
    mostrarFeedback("Hubo un error al registrar el movimiento.", "error");

  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerText = textoOriginal;
    btnEnviar.style.opacity = "1";
    btnEnviar.style.cursor = "pointer";
  }
}

function mostrarFeedback(texto, tipo) {
  const mensajeDiv = document.getElementById("mensaje");
  if (!mensajeDiv) return;

  mensajeDiv.textContent = texto;
  mensajeDiv.style.display = "block";
  mensajeDiv.style.marginTop = "15px";
  mensajeDiv.style.padding = "10px 14px";
  mensajeDiv.style.borderRadius = "8px";
  mensajeDiv.style.fontWeight = "500";
  mensajeDiv.style.textAlign = "center";

  if (tipo === "success") {
    mensajeDiv.style.backgroundColor = "#e6f4ea";
    mensajeDiv.style.color = "#137333";
    mensajeDiv.style.border = "1px solid #ceead6";
  } else {
    mensajeDiv.style.backgroundColor = "#fce8e6";
    mensajeDiv.style.color = "#c5221f";
    mensajeDiv.style.border = "1px solid #fad2cf";
  }

  setTimeout(() => {
    mensajeDiv.style.display = "none";
  }, 4000);
}

/* ==========================================================================
   LÓGICA DEL DASHBOARD (dasboard.html + Chart.js)
   ========================================================================== */
/**
 * Consulta el endpoint doGet de Apps Script y distribuye los datos en la UI
 */
async function cargarDatosDashboard() {
  mostrarOverlayCarga(true);

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Error desconocido al procesar datos");
    }

    // 1. Renderizar tarjetas de KPIs
    renderizarKPIs(data.kpis);

// 2. Renderizar gráficos Chart.js
    renderizarGraficoFlujo(data.monthlyFlow);
    renderizarGraficoCategorias(data.categories);
    renderizarTopCategorias(data.categories, data.kpis.totalGastos);

    // 3. Renderizar tabla con últimos 10 movimientos
    renderizarTablaMovimientos(data.recentMoves);

  } catch (error) {
    console.error("Error al cargar datos del dashboard:", error);
    mostrarErrorDashboard();

  } finally {
    // Apagar la pantalla de carga con un pequeño delay para que la transición sea fluida
    mostrarOverlayCarga(false);
  }
}

/**
 * Controla la visibilidad del overlay de carga
 * @param {boolean} mostrar 
 */
function mostrarOverlayCarga(mostrar) {
  const loader = document.getElementById("dashboard-loader");
  if (!loader) return;

  if (mostrar) {
    loader.classList.remove("hidden");
  } else {
    // 250ms de pausa para que los gráficos terminen su primera animación de entrada
    setTimeout(() => {
      loader.classList.add("hidden");
    }, 250);
  }
}

/**
 * Formatea valores numéricos en formato de moneda estándar ($ 1.234,56)
 */
function formatoMoneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor).replace("COP", "$").trim();
}

/**
 * Pinta los valores numéricos calculados en las cards superiores
 */
function renderizarKPIs(kpis) {
  const elAhorro    = document.getElementById("txt-ahorro");
  const elIngresos  = document.getElementById("txt-ingresos");
  const elGastos    = document.getElementById("txt-gastos");
  const elAhorroMes = document.getElementById("txt-ahorro-mes");

  if (elAhorro)   elAhorro.innerText   = formatoMoneda(kpis.ahorroTotal);
  if (elIngresos) elIngresos.innerText = formatoMoneda(kpis.totalIngresos);
  if (elGastos)   elGastos.innerText   = formatoMoneda(kpis.totalGastos);
  if (elAhorroMes) {
    // Si kpis.ahorroMesActual viene en valor monetario, se formatea en moneda
    elAhorroMes.innerText = formatoMoneda(kpis.ahorroMesActual);
  }
}

/**
 * Genera o actualiza el gráfico de barras mensual (Ingresos vs Gastos)
 */
function renderizarGraficoFlujo(flow) {
  const canvas = document.getElementById("flowChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (chartFlujoInstance) {
    chartFlujoInstance.destroy();
  }

  // Sanitización de etiquetas: si viene una fecha completa o timestamp, extraer solo el mes
  const sanitizedLabels = flow.labels.map((lbl) => {
    if (typeof lbl === "string" && (lbl.includes("GMT") || lbl.includes("T"))) {
      const d = new Date(lbl);
      if (!isNaN(d.getTime())) {
        const monthNames = ["January", "February", "March", "April", "May", "June", 
                            "July", "August", "September", "October", "November", "December"];
        const mesNum = ("0" + (d.getMonth() + 1)).slice(-2);
        return `${mesNum} - ${monthNames[d.getMonth()]}`;
      }
    }
    return lbl;
  });

  chartFlujoInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sanitizedLabels,
      datasets: [
        {
          label: "Ingresos",
          data: flow.ingresos,
          backgroundColor: "#38BDF8",
          borderRadius: 4
        },
        {
          label: "Gastos",
          data: flow.gastos,
          backgroundColor: "#334155",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#94A3B8", boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.dataset.label}: ${formatoMoneda(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#94A3B8" },
          grid: { display: false }
        },
        y: {
          ticks: {
            color: "#94A3B8",
            callback: (val) => formatoMoneda(val)
          },
          grid: { color: "rgba(255, 255, 255, 0.04)" }
        }
      }
    }
  });
}

/**
 * Genera o actualiza el gráfico de dona por categorías de gastos
 */
function renderizarGraficoCategorias(cats) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (chartCategoriasInstance) {
    chartCategoriasInstance.destroy();
  }

  // Paleta armónica integrada con tu tema glass/grafito
  const paletaColores = [
    "#38BDF8", "#0284C7", "#60A5FA", "#93C5FD",
    "#818CF8", "#A78BFA", "#C084FC", "#F472B6",
    "#FB7185", "#FBBF24", "#34D399", "#2DD4BF"
  ];

  chartCategoriasInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: cats.labels,
      datasets: [{
        data: cats.values,
        backgroundColor: paletaColores.slice(0, cats.labels.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#94A3B8", boxWidth: 10, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.label}: ${formatoMoneda(context.parsed)}`
          }
        }
      },
      cutout: "70%"
    }
  });
}

/**
 * Inyecta dinámicamente las filas de la tabla de transacciones recientes
 */
/**
 * Inyecta dinámicamente las filas de la tabla de transacciones recientes
 */
function renderizarTablaMovimientos(movimientos) {
  const tbody = document.getElementById("tabla-movimientos");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!movimientos || movimientos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">
          No hay movimientos registrados aún.
        </td>
      </tr>
    `;
    return;
  }

  movimientos.forEach((mov) => {
    const tr = document.createElement("tr");

    const esIngreso = mov.tipo === "ingreso";
    const signo = esIngreso ? "+ " : "- ";
    const claseImporte = esIngreso ? "income-val" : "expense-val";

    // 1. Formateo limpio de la fecha (de ISO "2026-12-11T..." a "11/12")
    let fechaLimpia = mov.fecha;
    if (typeof mov.fecha === "string" && mov.fecha.includes("T")) {
      const d = new Date(mov.fecha);
      if (!isNaN(d.getTime())) {
        const dia = ("0" + d.getUTCDate()).slice(-2);
        const mes = ("0" + (d.getUTCMonth() + 1)).slice(-2);
        fechaLimpia = `${dia}/${mes}`;
      }
    }

    // 2. Asignación semántica de clase para la insignia de categoría
    const catLower = mov.categoria.toLowerCase();
    let badgeClass = "badge-otros";

    if (esIngreso) {
      badgeClass = "ingresos";
    } else if (catLower.includes("vivienda")) {
      badgeClass = "vivienda";
    } else if (catLower.includes("alimentacion") || catLower.includes("mercado")) {
      badgeClass = "alimentacion";
    } else if (catLower.includes("transporte")) {
      badgeClass = "transporte";
    } else if (catLower.includes("servicio")) {
      badgeClass = "servicios";
    }

    tr.innerHTML = `
      <td><span class="badge ${badgeClass}">${mov.categoria}</span></td>
      <td class="td-concepto">${mov.concepto || "-"}</td>
      <td class="td-fecha">${fechaLimpia}</td>
      <td class="${claseImporte}">${signo}${formatoMoneda(mov.importe)}</td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * Estados visuales de carga y error
 */
function mostrarEstadoCargaCards(cargando) {
  const ids = ["txt-ahorro", "txt-ingresos", "txt-gastos", "txt-ahorro-mes"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el && cargando) {
      el.innerText = "...";
      el.style.opacity = "0.5";
    } else if (el) {
      el.style.opacity = "1";
    }
  });
}

function mostrarErrorDashboard() {
  mostrarEstadoCargaCards(false);
  const tbody = document.getElementById("tabla-movimientos");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: #ef4444; padding: 16px;">
          Error al conectar con Google Sheets. Revisa la consola o los permisos del script.
        </td>
      </tr>
    `;
  }
}

/**
 * Renderiza el Top 3 de categorías con mayor gasto junto con su % y barra de progreso
 * @param {Object} cats - { labels: string[], values: number[] }
 * @param {number} totalGastos - Total acumulado de gastos para calcular porcentajes
 */
function renderizarTopCategorias(cats, totalGastos) {
  const container = document.getElementById("top-categories-list");
  if (!container) return;

  container.innerHTML = "";

  if (!cats || !cats.labels || cats.labels.length === 0 || !totalGastos) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">Sin datos de gastos.</p>`;
    return;
  }

  // 1. Mapear en objetos individuales para ordenar sin perder la referencia
  const listaCategorias = cats.labels.map((nombre, i) => {
    return {
      nombre: nombre,
      monto: cats.values[i] || 0
    };
  });

  // 2. Ordenar descendentemente por monto y tomar las 3 mayores
  listaCategorias.sort((a, b) => b.monto - a.monto);
  const top3 = listaCategorias.slice(0, 3);

  // Paleta idéntica a la que utiliza el gráfico de dona en app.js
  const colores = ["#38BDF8", "#0284C7", "#60A5FA"];

  // 3. Crear elementos del DOM
  top3.forEach((item, index) => {
    const porcentaje = ((item.monto / totalGastos) * 100).toFixed(1);
    const color = colores[index] || "#38BDF8";

    const catDiv = document.createElement("div");
    catDiv.className = "top-cat-item";

    catDiv.innerHTML = `
      <div class="top-cat-header">
        <span class="top-cat-name">
          <span class="top-cat-dot" style="background-color: ${color};"></span>
          ${item.nombre}
        </span>
        <span class="top-cat-values">
          <span class="top-cat-amount">${formatoMoneda(item.monto)}</span>
          (${porcentaje}%)
        </span>
      </div>
      <div class="top-cat-progress-bg">
        <div class="top-cat-progress-bar" style="width: ${porcentaje}%; background-color: ${color};"></div>
      </div>
    `;

    container.appendChild(catDiv);
  });
}

// Registro del Service Worker para soporte PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registrado:', reg.scope))
      .catch((err) => console.warn('Error al registrar Service Worker:', err));
  });
}