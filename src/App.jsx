import React, { useEffect, useMemo, useRef, useState } from "react";

const API = "";
// Menu exemplo (ajuste como quiser)
const MENU = [
  { id: "marmita_p", nome: "Marmita Pequena", setor: "cozinha", preco: 18 },
  { id: "marmita_m", nome: "Marmita Média", setor: "cozinha", preco: 22 },
  { id: "marmita_g", nome: "Marmita Grande", setor: "cozinha", preco: 28 },

  {
    id: "pf_evento",
    nome: "Prato Feito (Evento)",
    setor: "cozinha",
    preco: 25,
    opcoesLabel: "sabor",
    opcoes: ["Frango", "Vaca atolada", "Linguiça", "Carne assada"],
  },

  { id: "bolo_pote", nome: "Bolo de Pote", setor: "cozinha", preco: 10 },

  {
    id: "refri_lata",
    nome: "Refrigerante (lata)",
    setor: "bebidas",
    preco: 6,
    opcoesLabel: "marca",
    opcoes: ["Coca", "Guaraná", "Fanta", "Pepsi"],
  },
  { id: "agua_sg", nome: "Água sem gás", setor: "bebidas", preco: 3 },
  { id: "agua_cg", nome: "Água com gás", setor: "bebidas", preco: 4 },
  { id: "dose_pinga", nome: "Dose de pinga", setor: "bebidas", preco: 5 },
  { id: "cerveja_350", nome: "Cerveja 350ml", setor: "bebidas", preco: 7 },
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function formatBRL(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function apiGet(path) {
  const r = await fetch("./db.json");
  if (!r.ok) throw new Error(`GET db.json -> ${r.status}`);
  const data = await r.json();

  // path vem tipo "/mesas" ou "/pedidos"
  const key = path.replace("/", "");
  return data[key];
}

async function apiPost(path, body) {
  console.warn("GitHub Pages: sem backend. POST não salva.", path, body);
  return body; // só devolve
}

async function apiPut(path, body) {
  console.warn("GitHub Pages: sem backend. PUT não salva.", path, body);
  return body;
}
async function apiDel(path) {
  console.warn("GitHub Pages: sem backend. DELETE não salva.", path);
  return true;
}

export default function App() {
  const [tab, setTab] = useState("pedidos"); // pedidos | cozinha | bebidas | historico
  const [mesaInput, setMesaInput] = useState("");
  const [mesasAbertas, setMesasAbertas] = useState([]); // [{ id (json-server), idMesa, itens:[] , status }]
  const [historico, setHistorico] = useState([]); // [{ id (json-server), idMesa, data, itens, total }]
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const saveTimer = useRef(null);

 const menuPorSetor = {
  cozinha: MENU.filter((i) => i.setor === "cozinha"),
  bebidas: MENU.filter((i) => i.setor === "bebidas"),
};

  // ======= CARREGAR DO JSON-SERVER (uma vez) =======
  useEffect(() => {
    (async () => {
      try {
        const [mesasDb, pedidosDb] = await Promise.all([
          apiGet("/mesas"),
          apiGet("/pedidos"),
        ]);

        // remove duplicados por idMesa (se tiver “sujeira” antiga)
        const map = new Map();
        for (const m of Array.isArray(mesasDb) ? mesasDb : []) {
          if (!m) continue;
          const key = String(m.idMesa ?? "");
          if (!key) continue;
          if (!map.has(key)) map.set(key, m);
        }
        const mesasUnicas = Array.from(map.values());

        setMesasAbertas(
          mesasUnicas.map((m) => ({
            id: m.id,
            idMesa: String(m.idMesa),
            status: m.status || "ABERTO",
            itens: Array.isArray(m.itens) ? m.itens : [],
          }))
        );

        setHistorico(
          (Array.isArray(pedidosDb) ? pedidosDb : []).map((p) => ({
            id: p.id,
            idMesa: String(p.idMesa),
            data: p.data,
            itens: Array.isArray(p.itens) ? p.itens : [],
            total: Number(p.total) || 0,
          }))
        );

        setLoaded(true);
      } catch (e) {
        console.error("Erro ao carregar do json-server:", e);
        alert(
          "Não consegui carregar do json-server. Confere se ele está rodando na porta 3002."
        );
      }
    })();
  }, []);
  useEffect(() => {
  const intervalo = setInterval(() => {
    (async () => {
      try {
        const [mesasDb, pedidosDb] = await Promise.all([
          apiGet("/mesas"),
          apiGet("/pedidos"),
        ]);

setMesas([...(mesasDb || [])]);
setPedidos([...(pedidosDb || [])]);
setTick(t => t + 1);
      } catch {}
    })();
  }, 2000);

  return () => clearInterval(intervalo);
}, []);

  // ======= SALVAR NO JSON-SERVER (com debounce, só depois que carregou) =======
  useEffect(() => {
    if (!loaded) return;

    // debounce: espera 600ms após última mudança
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      (async () => {
        try {
          // 1) salvar mesas (upsert por ID do json-server)
          for (const mesa of mesasAbertas) {
            const payload = {
              idMesa: String(mesa.idMesa),
              status: mesa.status || "ABERTO",
              itens: Array.isArray(mesa.itens) ? mesa.itens : [],
            };

            if (mesa.id) {
              await apiPut(`/mesas/${mesa.id}`, payload);
            } else {
              const created = await apiPost(`/mesas`, payload);
              // atualiza o id local, sem duplicar
              setMesasAbertas((prev) =>
                prev.map((m) =>
                  m === mesa ? { ...m, id: created.id } : m
                )
              );
            }
          }
        } catch (e) {
          console.error("Erro ao salvar mesas:", e);
        }
      })();
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [mesasAbertas, loaded]);

  // ======= AÇÕES =======
  function criarMesa() {
    const n = mesaInput.trim();
    if (!n) return alert("Digite o número da mesa.");
    const jaExiste = mesasAbertas.some((m) => String(m.idMesa) === n);
    if (jaExiste) return alert("Essa mesa já está aberta.");

    setMesasAbertas((prev) => [
      { idMesa: n, status: "ABERTO", itens: [] },
      ...prev,
    ]);
    setMesaInput("");
  }

  function pedirItem(idMesa, itemMenu) {
    let opcaoEscolhida = null;

    if (itemMenu.opcoes && itemMenu.opcoes.length) {
      const msg =
        `${itemMenu.nome}\nEscolha ${itemMenu.opcoesLabel || "opção"}:\n` +
        itemMenu.opcoes.map((o, idx) => `${idx + 1}) ${o}`).join("\n") +
        `\n\nDigite o número da opção:`;

      const resp = prompt(msg);
      if (resp === null) return; // cancelou
      const idx = Number(resp) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= itemMenu.opcoes.length) {
        return alert("Opção inválida.");
      }
      opcaoEscolhida = itemMenu.opcoes[idx];
    }

    const novoItem = {
      id: uid(),
      menuId: itemMenu.id,
      nome: itemMenu.nome,
      setor: itemMenu.setor,
      preco: Number(itemMenu.preco) || 0,
      opcao: opcaoEscolhida,
      qtd: 1,
    };

    setMesasAbertas((prev) =>
      prev.map((m) => {
        if (String(m.idMesa) !== String(idMesa)) return m;
        return { ...m, itens: [novoItem, ...(m.itens || [])] };
      })
    );
  }

  function removerItem(idMesa, itemId) {
    setMesasAbertas((prev) =>
      prev.map((m) => {
        if (String(m.idMesa) !== String(idMesa)) return m;
        return { ...m, itens: (m.itens || []).filter((it) => it.id !== itemId) };
      })
    );
  }

  async function fecharMesa(idMesa) {
    const mesa = mesasAbertas.find((m) => String(m.idMesa) === String(idMesa));
    if (!mesa) return;

    const total = (mesa.itens || []).reduce(
      (acc, it) => acc + (Number(it.preco) || 0) * (Number(it.qtd) || 1),
      0
    );

    const pedido = {
      idMesa: String(mesa.idMesa),
      data: new Date().toISOString(),
      itens: mesa.itens || [],
      total,
    };

    try {
      const created = await apiPost("/pedidos", pedido);
      setHistorico((prev) => [{ ...pedido, id: created.id }, ...prev]);

      // remove mesa do estado
      setMesasAbertas((prev) => prev.filter((m) => m !== mesa));

      // remove do banco (se tiver id)
      if (mesa.id) await apiDel(`/mesas/${mesa.id}`);
    } catch (e) {
      console.error("Erro ao fechar mesa:", e);
      alert("Erro ao fechar mesa. Veja o console.");
    }
  }

  async function apagarTudo() {
    if (!confirm("Apagar tudo do sistema? (mesas e histórico)")) return;
    try {
      const [mesasDb, pedidosDb] = await Promise.all([
        apiGet("/mesas"),
        apiGet("/pedidos"),
      ]);
      for (const m of mesasDb) await apiDel(`/mesas/${m.id}`);
      for (const p of pedidosDb) await apiDel(`/pedidos/${p.id}`);

      setMesasAbertas([]);
      setHistorico([]);
      setMesaInput("");
      setTab("pedidos");
      alert("Tudo apagado ✅");
    } catch (e) {
      console.error("Erro ao apagar tudo:", e);
      alert("Deu erro ao apagar. Veja o console.");
    }
  }

  function totalMesa(mesa) {
    return (mesa.itens || []).reduce(
      (acc, it) => acc + (Number(it.preco) || 0) * (Number(it.qtd) || 1),
      0
    );
  }

  // ======= UI =======
  const mesasOrdenadas = useMemo(() => {
    const copy = [...mesasAbertas];
    copy.sort((a, b) => Number(a.idMesa) - Number(b.idMesa));
    return copy;
  }, [mesasAbertas, tick]);

  const tabMenu = (
    <div style={styles.tabs}>
      <button style={tab === "pedidos" ? styles.tabOn : styles.tab} onClick={() => setTab("pedidos")}>
        Pedidos por mesa
      </button>
      <button style={tab === "cozinha" ? styles.tabOn : styles.tab} onClick={() => setTab("cozinha")}>
        Cozinha
      </button>
      <button style={tab === "bebidas" ? styles.tabOn : styles.tab} onClick={() => setTab("bebidas")}>
        Bebidas
      </button>
      <button style={tab === "historico" ? styles.tabOn : styles.tab} onClick={() => setTab("historico")}>
        Histórico
      </button>

      <div style={{ flex: 1 }} />
      <button style={styles.danger} onClick={apagarTudo}>Apagar tudo</button>
    </div>
  );

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Sistema Restaurante 🍽️</h1>
      {tabMenu}

      {tab === "pedidos" && (
        <>
          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Número da mesa"
              value={mesaInput}
              onChange={(e) => setMesaInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criarMesa()}
            />
            <button style={styles.btn} onClick={criarMesa}>Nova Mesa</button>
          </div>

          {mesasOrdenadas.length === 0 && (
            <div style={styles.card}>Nenhuma mesa aberta.</div>
          )}

          {mesasOrdenadas.map((mesa) => (
            <div key={mesa.idMesa} style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardTitle}>
                  Mesa {mesa.idMesa} — <span style={{ color: "#22c55e" }}>ABERTO</span>
                </div>
                <button style={styles.btnSmall} onClick={() => fecharMesa(mesa.idMesa)}>
                  Fechar mesa
                </button>
              </div>

              <div style={styles.chipsWrap}>
                {MENU.map((it) => (
                  <button
                    key={it.id}
                    style={styles.chip}
                    onClick={() => pedirItem(mesa.idMesa, it)}
                    title={`${formatBRL(it.preco)}`}
                  >
                    + {it.nome}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                {(mesa.itens || []).length === 0 ? (
                  <div style={styles.muted}>Nenhum item ainda.</div>
                ) : (
                  (mesa.itens || []).map((it) => (
                    <div key={it.id} style={styles.itemRow}>
                      <div>
                        <div style={styles.itemName}>
                          {it.nome}{it.opcao ? ` — ${it.opcao}` : ""}
                        </div>
                        <div style={styles.muted}>
                          Setor: {it.setor.toUpperCase()} • {formatBRL(it.preco)}
                        </div>
                      </div>
                      <button style={styles.btnSmall} onClick={() => removerItem(mesa.idMesa, it.id)}>
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.total}>Total: {formatBRL(totalMesa(mesa))}</div>
            </div>
          ))}
        </>
      )}

      {tab === "cozinha" && (
        <div style={styles.card}>
          <h2 style={styles.h2}>Cozinha</h2>
          <div style={styles.muted}>
            Aqui você pode colocar uma visão separada (opcional).
          </div>
          <div style={{ marginTop: 10 }}>
            Itens de cozinha cadastrados: <b>{menuPorSetor.cozinha.length}</b>
          </div>
        </div>
      )}

      {tab === "bebidas" && (
        <div style={styles.card}>
          <h2 style={styles.h2}>Bebidas</h2>
          <div style={styles.muted}>
            Aqui você pode colocar uma visão separada (opcional).
          </div>
          <div style={{ marginTop: 10 }}>
            Itens de bebidas cadastrados: <b>{menuPorSetor.bebidas.length}</b>
          </div>
        </div>
      )}

      {tab === "historico" && (
        <div style={styles.card}>
          <h2 style={styles.h2}>Histórico</h2>
          {historico.length === 0 ? (
            <div style={styles.muted}>Nenhum pedido no histórico.</div>
          ) : (
            historico.map((p) => (
              <div key={p.id} style={styles.histCard}>
                <div style={styles.itemName}>
                  Mesa {p.idMesa} • {new Date(p.data).toLocaleString("pt-BR")}
                </div>
                <div style={styles.muted}>
                  Itens: {p.itens.length} • Total: <b>{formatBRL(p.total)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div style={styles.footer}>
        Dica: esse app salva no <b>json-server (porta 3002)</b>. Se fechar e abrir, mantém tudo.
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" },
  h1: { margin: "10px 0 8px" },
  h2: { margin: 0 },
  row: { display: "flex", gap: 10, alignItems: "center", margin: "10px 0 16px" },
  input: { padding: 10, borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff", minWidth: 220 },
  btn: { padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#222", color: "#fff", cursor: "pointer" },
  btnSmall: { padding: "8px 10px", borderRadius: 10, border: "1px solid #333", background: "#222", color: "#fff", cursor: "pointer" },
  danger: { padding: "10px 12px", borderRadius: 10, border: "1px solid #7f1d1d", background: "#2a0f0f", color: "#fff", cursor: "pointer" },
  tabs: { display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" },
  tab: { padding: "8px 10px", borderRadius: 999, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" },
  tabOn: { padding: "8px 10px", borderRadius: 999, border: "1px solid #555", background: "#222", color: "#fff", cursor: "pointer" },
  card: { border: "1px solid #333", borderRadius: 16, padding: 14, marginBottom: 12, background: "#0f0f0f", color: "#fff" },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 700 },
  chipsWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { padding: "8px 10px", borderRadius: 999, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" },
  itemRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderTop: "1px solid #222", paddingTop: 10, marginTop: 10 },
  itemName: { fontWeight: 700 },
  muted: { opacity: 0.75, fontSize: 13 },
  total: { marginTop: 10, fontWeight: 800 },
  histCard: { borderTop: "1px solid #222", paddingTop: 10, marginTop: 10 },
  footer: { opacity: 0.7, marginTop: 14, fontSize: 13, color: "#fff" },
};