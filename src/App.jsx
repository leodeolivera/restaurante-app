import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/**
 * ============================================================
 *  CONFIG SUPABASE
 * ============================================================
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

/**
 * ============================================================
 *  HELPERS
 * ============================================================
 */
function detectarSetorPorCategoria(categoria) {
  const c = String(categoria || "").toLowerCase().trim();

  const palavrasBar = [
    "bar",
    "bebida",
    "cerveja",
    "refrigerante",
    "suco",
    "água",
    "agua",
    "drink",
    "destilado",
    "lata",
    "dose",
    "vinho",
    "whisky",
    "vodka",
    "gin",
    "energetico",
    "energético",
  ];

  const ehBar = palavrasBar.some((p) => c.includes(p));
  return ehBar ? "bar" : "cozinha";
}

function brl(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function somarCarrinho(itens) {
  return itens.reduce((acc, i) => acc + Number(i.subtotal || 0), 0);
}

function clampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function hojeISO() {
  return new Date().toISOString();
}

/**
 * ============================================================
 *  COMPONENTES
 * ============================================================
 */
function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.pill,
        ...(active ? styles.pillActive : styles.pillInactive),
      }}
    >
      {children}
    </button>
  );
}

function Badge({ tone = "neutral", children }) {
  const map = {
    neutral: styles.badgeNeutral,
    green: styles.badgeGreen,
    red: styles.badgeRed,
    blue: styles.badgeBlue,
    yellow: styles.badgeYellow,
    gray: styles.badgeGray,
  };
  return <span style={{ ...styles.badge, ...(map[tone] || {}) }}>{children}</span>;
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={styles.sectionTitleWrap}>
      <div style={styles.sectionTitle}>{title}</div>
      {subtitle ? <div style={styles.sectionSubtitle}>{subtitle}</div> : null}
    </div>
  );
}

function EmptyState({ title, desc }) {
  return (
    <div style={styles.emptyWrap}>
      <div style={styles.emptyTitle}>{title}</div>
      {desc ? <div style={styles.emptyDesc}>{desc}</div> : null}
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast?.show) return null;
  return (
    <div style={styles.toastWrap} onClick={onClose}>
      <div style={{ ...styles.toast, ...(toast.type === "error" ? styles.toastError : styles.toastOk) }}>
        <div style={styles.toastTitle}>{toast.title}</div>
        {toast.message ? <div style={styles.toastMessage}>{toast.message}</div> : null}
      </div>
    </div>
  );
}

/**
 * ============================================================
 *  APP
 * ============================================================
 */
export default function App() {
  const [aba, setAba] = useState("mesas");

  const [mesas, setMesas] = useState([]);
  const [produtos, setProdutos] = useState([]);

  const [itensCozinha, setItensCozinha] = useState([]);
  const [itensBar, setItensBar] = useState([]);
  const [pedidosCaixa, setPedidosCaixa] = useState([]);
  const [historicoPedidos, setHistoricoPedidos] = useState([]);
const [loadingHistorico, setLoadingHistorico] = useState(false);

  const [loadingMesas, setLoadingMesas] = useState(true);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [loadingPainel, setLoadingPainel] = useState(false);

  const [mesaNumeroNovo, setMesaNumeroNovo] = useState("");
  const [mesaNomeNovo, setMesaNomeNovo] = useState("");

  const [mesaSelecionada, setMesaSelecionada] = useState(null);

  const [carrinho, setCarrinho] = useState([]);
  const totalCarrinho = useMemo(() => somarCarrinho(carrinho), [carrinho]);

  const [observacao, setObservacao] = useState("");

  const [toast, setToast] = useState({ show: false, type: "ok", title: "", message: "" });
  const toastTimer = useRef(null);

  function showToast(type, title, message) {
    clearTimeout(toastTimer.current);
    setToast({ show: true, type, title, message });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 3500);
  }

  useEffect(() => {
    carregarTudo();

    const channel = supabase
      .channel("realtime-restaurante")
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, () => carregarMesas())
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, () => carregarProdutos())
      .on("postgres_changes", { event: "*", schema: "public", table: "itens_pedido" }, () => {
        if (aba === "cozinha" || aba === "bar") carregarPainel();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 async function carregarTudo() {
  await Promise.all([
    carregarMesas(),
    carregarProdutos(),
    carregarPedidosCaixa(),
    carregarHistorico()
  ]);
}
 async function carregarPedidosCaixa() {
  try {
    const { data, error } = await supabase
      .from("pedidos")
      .select(`
        id,
        mesa_numero,
        total,
        status,
        mesa_id,
        created_at,
        itens_pedido (
          id,
          quantidade,
          preco_unitario,
          produto_id,
          produtos (
            id,
            nome
          )
        )
      `)
      .eq("status", "aberta")
      .order("mesa_numero", { ascending: true });

    if (error) throw error;

    console.log("PEDIDOS CAIXA:", data);
    setPedidosCaixa(data || []);
  } catch (e) {
    console.error("ERRO CAIXA:", e);
    showToast("error", "Erro ao carregar caixa", String(e.message || e));
  }
}
async function carregarHistorico() {
  try {
    setLoadingHistorico(true);

    const { data, error } = await supabase
      .from("pedidos")
      .select(`
        id,
        mesa_numero,
        total,
        forma_pagam,
        created_at
      `)
      .eq("status", "finalizado")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setHistoricoPedidos(data || []);
  } catch (e) {
    console.error("ERRO HISTORICO:", e);
    showToast("error", "Erro ao carregar histórico", String(e.message || e));
  } finally {
    setLoadingHistorico(false);
  }
}
async function fecharConta(pedidoAgrupado, formaPagamento) {
  try {
    const idsValidos = (pedidoAgrupado.pedidos_ids || []).filter(
      (id) => id !== undefined && id !== null && String(id).trim() !== ""
    );

    if (idsValidos.length === 0) {
      throw new Error("Nenhum pedido válido encontrado para essa mesa.");
    }

    for (const pedidoId of idsValidos) {
      const { error: errPedido } = await supabase
        .from("pedidos")
        .update({
          status: "finalizado",
          forma_pagam: formaPagamento,
        })
        .eq("id", pedidoId);

      if (errPedido) throw errPedido;
    }

    const { error: errMesa } = await supabase
      .from("mesas")
      .update({ status: "fechada" })
      .eq("numero", pedidoAgrupado.mesa_numero);

    if (errMesa) throw errMesa;

    await carregarPedidosCaixa();
    await carregarMesas();

    showToast(
      "ok",
      "Conta fechada",
      `Mesa ${pedidoAgrupado.mesa_numero} paga em ${formaPagamento}`
    );
  } catch (e) {
    console.error(e);
    showToast("error", "Erro ao fechar conta", String(e.message || e));
  }
}

  async function carregarMesas() {
    try {
      setLoadingMesas(true);
      const { data, error } = await supabase
  .from("mesas")
  .select("*")
  .neq("status", "excluida")
  .order("numero", { ascending: true });
      if (error) throw error;

      setMesas((data || []).filter(m => m.status !== "excluida"));
      if (mesaSelecionada) {
        const still = (data || []).find(m => m.id === mesaSelecionada.id);

if (!still) {
  setMesaSelecionada(null);
} else {
  setMesaSelecionada(still);
}
      }
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao carregar mesas", String(e.message || e));
    } finally {
      setLoadingMesas(false);
    }
  }

  async function carregarProdutos() {
    try {
      setLoadingProdutos(true);
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      setProdutos(data || []);
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao carregar produtos", String(e.message || e));
    } finally {
      setLoadingProdutos(false);
    }
  }

  async function carregarPainel() {
    try {
      setLoadingPainel(true);

      const { data, error } = await supabase
        .from("itens_pedido")
        .select(
          `
          id, created_at, pedido_id, produto_id, quantidade, preco_unitario, subtotal, setor, status, observacao,
          produtos:produto_id (id, nome, categoria),
          pedidos:pedido_id (id, mesa_numero, status, created_at)
        `
        )
        .order("created_at", { ascending: true });

      if (error) throw error;

      const itens = (data || []).filter((i) => {
        const st = String(i.status || "").toLowerCase();
        return !["pronto", "entregue", "finalizado", "cancelado"].includes(st);
      });

      setItensCozinha(itens.filter((i) => String(i.setor).toLowerCase() === "cozinha"));
      setItensBar(itens.filter((i) => String(i.setor).toLowerCase() === "bar"));
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao carregar painel", String(e.message || e));
    } finally {
      setLoadingPainel(false);
    }
  }

  useEffect(() => {
    if (aba === "cozinha" || aba === "bar") carregarPainel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);
  useEffect(() => {
  if (aba === "caixa") {
    carregarPedidosCaixa();
  }
}, [aba]);

  async function criarMesa() {
    try {
      const numero = parseInt(mesaNumeroNovo, 10);
      if (!numero || numero <= 0) {
        showToast("error", "Número inválido", "Digite um número de mesa válido (ex: 10).");
        return;
      }

      const payload = { numero, status: "aberta", nome: mesaNomeNovo?.trim() ? mesaNomeNovo.trim() : null };
      const { error } = await supabase.from("mesas").upsert(payload, { onConflict: "numero" });
      if (error) throw error;

      setMesaNumeroNovo("");
      setMesaNomeNovo("");
      showToast("ok", "Mesa criada", `Mesa ${numero} criada com sucesso.`);
      await carregarMesas();
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao criar mesa", String(e.message || e));
    }
  }

  async function excluirMesa(mesa) {
    try {
      if (!mesa?.id) return;
      const ok = confirm(`Tem certeza que deseja EXCLUIR a mesa ${mesa.numero}?`);
      if (!ok) return;

      const { error } = await supabase
  .from("mesas")
  .update({ status: "excluida" })
  .eq("id", mesa.id);
      if (error) throw error;

      if (mesaSelecionada?.id === mesa.id) {
        setMesaSelecionada(null);
        setCarrinho([]);
      }

      showToast("ok", "Mesa excluída", `Mesa ${mesa.numero} removida.`);
      setMesas(prev => prev.filter(m => m.id !== mesa.id));
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao excluir mesa", String(e.message || e));
    }
  }

  async function reabrirMesa(mesa) {
    try {
      const { error } = await supabase.from("mesas").update({ status: "aberta" }).eq("id", mesa.id);
      if (error) throw error;

      showToast("ok", "Mesa reaberta", `Mesa ${mesa.numero} agora está aberta.`);
      await carregarMesas();
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao reabrir mesa", String(e.message || e));
    }
  }

  async function fecharMesa(mesa) {
    try {
      const { error } = await supabase.from("mesas").update({ status: "fechada" }).eq("id", mesa.id);
      if (error) throw error;

      showToast("ok", "Mesa fechada", `Mesa ${mesa.numero} agora está fechada.`);
      await carregarMesas();
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao fechar mesa", String(e.message || e));
    }
  }

  function adicionarAoCarrinho(prod) {
    if (!mesaSelecionada) {
      showToast("error", "Selecione uma mesa", "Você precisa selecionar uma mesa antes de adicionar itens.");
      return;
    }

    const setor = detectarSetorPorCategoria(prod.categoria);

    setCarrinho((prev) => {
      const idx = prev.findIndex((x) => x.produto.id === prod.id);
      if (idx >= 0) {
        const clone = [...prev];
        const item = clone[idx];
        const q = clampInt(Number(item.quantidade) + 1, 1, 999);
        clone[idx] = {
          ...item,
          quantidade: q,
          subtotal: Number(prod.preco || 0) * q,
          setor,
        };
        return clone;
      }
      return [
        ...prev,
        {
          produto: prod,
          quantidade: 1,
          preco_unitario: Number(prod.preco || 0),
          subtotal: Number(prod.preco || 0),
          setor,
        },
      ];
    });
  }

  function removerDoCarrinho(produtoId) {
    setCarrinho((prev) => prev.filter((x) => x.produto.id !== produtoId));
  }

  function alterarQuantidade(produtoId, novaQtd) {
    setCarrinho((prev) => {
      const clone = [...prev];
      const idx = clone.findIndex((x) => x.produto.id === produtoId);
      if (idx < 0) return prev;

      const item = clone[idx];
      const q = clampInt(Number(novaQtd), 1, 999);
      clone[idx] = { ...item, quantidade: q, subtotal: Number(item.preco_unitario) * q };
      return clone;
    });
  }

  function limparCarrinho() {
    setCarrinho([]);
    setObservacao("");
  }

  /**
   * ============================================================
   *  ENVIAR PEDIDO (SEM forma_pagam pra não quebrar seu banco)
   * ============================================================
   */
  async function enviarPedido() {
    try {
      if (!mesaSelecionada) {
        showToast("error", "Selecione uma mesa", "Escolha a mesa antes de enviar o pedido.");
        return;
      }
      if (carrinho.length === 0) {
        showToast("error", "Carrinho vazio", "Adicione itens antes de enviar.");
        return;
      }

      // 1) Cria o pedido
      const payloadPedido = {
        created_at: hojeISO(),
        mesa_numero: mesaSelecionada.numero,
        status: "aberta",
        total: totalCarrinho,
        observacao: observacao?.trim() ? observacao.trim() : null,
        origem: "garcom",
        destino: "cozinha",
        mesa_id: mesaSelecionada.id,
      };

      const { data: pedidoCriado, error: errPedido } = await supabase
        .from("pedidos")
        .insert(payloadPedido)
        .select("*")
        .single();

      if (errPedido) throw errPedido;

      // 2) Insere itens no pedido com setor correto (bar/cozinha)
     const itensPayload = carrinho.map((item) => {
  const setor = detectarSetorPorCategoria(item.produto.categoria);

  return {
    created_at: hojeISO(),
    pedido_id: pedidoCriado.id,
    produto_id: item.produto.id,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    setor: setor,
    status: "recebido",
    observacao: observacao || null,
  };
});

      const { error: errItens } = await supabase.from("itens_pedido").insert(itensPayload);
      if (errItens) throw errItens;

      // 3) Mantém mesa aberta
      await supabase.from("mesas").update({ status: "aberta" }).eq("id", mesaSelecionada.id);

      showToast("ok", "Pedido enviado", "Pedido enviado para Cozinha/Bar ✅");
      limparCarrinho();

      if (aba === "cozinha" || aba === "bar") await carregarPainel();
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao enviar pedido", String(e.message || e));
    }
  }

  async function marcarItemComoPronto(itemId) {
    try {
      const { error } = await supabase.from("itens_pedido").update({ status: "pronto" }).eq("id", itemId);
      if (error) throw error;
      showToast("ok", "Item pronto", "Item marcado como pronto.");
      await carregarPainel();
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao atualizar item", String(e.message || e));
    }
  }

  async function cancelarItem(itemId) {
    try {
      const ok = confirm("Deseja cancelar este item?");
      if (!ok) return;

      const { error } = await supabase.from("itens_pedido").update({ status: "cancelado" }).eq("id", itemId);
      if (error) throw error;

      showToast("ok", "Item cancelado", "Item cancelado.");
      await carregarPainel();
    } catch (e) {
      console.error(e);
      showToast("error", "Erro ao cancelar item", String(e.message || e));
    }
  }

  const mesasOrdenadas = useMemo(() => [...mesas].sort((a, b) => Number(a.numero) - Number(b.numero)), [mesas]);

  const produtosOrdenados = useMemo(
    () => [...produtos].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")),
    [produtos]
  );

  const itensPainel = useMemo(() => (aba === "cozinha" ? itensCozinha : aba === "bar" ? itensBar : []), [
    aba,
    itensCozinha,
    itensBar,
  ]);
  const pedidosCaixaAgrupados = useMemo(() => {
  const mapa = {};

  for (const pedido of pedidosCaixa) {
    const chave = String(pedido.mesa_numero);

    if (!mapa[chave]) {
      mapa[chave] = {
        mesa_numero: pedido.mesa_numero,
        mesa_id: pedido.mesa_id,
        pedidos_ids: [],
        itens: [],
        total: 0,
      };
    }

    if (pedido.id !== undefined && pedido.id !== null) {
  mapa[chave].pedidos_ids.push(pedido.id);
}
    mapa[chave].total += Number(pedido.total || 0);

    if (Array.isArray(pedido.itens_pedido)) {
      mapa[chave].itens.push(...pedido.itens_pedido);
    }
  }

  return Object.values(mapa).sort((a, b) => Number(a.mesa_numero) - Number(b.mesa_numero));
}, [pedidosCaixa]);
const totalDinheiro = useMemo(
  () =>
    historicoPedidos
      .filter((p) => String(p.forma_pagam || "").toLowerCase() === "dinheiro")
      .reduce((acc, p) => acc + Number(p.total || 0), 0),
  [historicoPedidos]
);

const totalCartao = useMemo(
  () =>
    historicoPedidos
      .filter((p) => String(p.forma_pagam || "").toLowerCase() === "cartao")
      .reduce((acc, p) => acc + Number(p.total || 0), 0),
  [historicoPedidos]
);

const totalPix = useMemo(
  () =>
    historicoPedidos
      .filter((p) => String(p.forma_pagam || "").toLowerCase() === "pix")
      .reduce((acc, p) => acc + Number(p.total || 0), 0),
  [historicoPedidos]
);

const totalGeralHistorico = useMemo(
  () => historicoPedidos.reduce((acc, p) => acc + Number(p.total || 0), 0),
  [historicoPedidos]
);

const historicoAgrupado = Object.values(
  historicoPedidos.reduce((acc, p) => {
    const mesa = p.mesa_numero;

    if (!acc[mesa]) {
      acc[mesa] = {
        mesa: mesa,
        total: 0,
        pagamentos: new Set(),
        pedidos: 0
      };
    }

    acc[mesa].total += Number(p.total || 0);
    acc[mesa].pagamentos.add(p.forma_pagam);
    acc[mesa].pedidos += 1;

    return acc;
  }, {})
);

  return (
    <div style={styles.page}>
      <Toast toast={toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      <div style={styles.header}>
        <div>
          <div style={styles.brandRow}>
            <div style={styles.brandLogo}>SV</div>
            <div>
              <div style={styles.brandTitle}>Sistema Restaurante</div>
              <div style={styles.brandSub}>Mesas • Cozinha • Bar • Caixa • Histórico</div>
            </div>
          </div>
        </div>

        <div style={styles.tabs}>
          <Pill active={aba === "mesas"} onClick={() => setAba("mesas")}>
Mesas
</Pill>

<Pill active={aba === "cozinha"} onClick={() => setAba("cozinha")}>
Cozinha
</Pill>

<Pill active={aba === "bar"} onClick={() => setAba("bar")}>
  Bar
</Pill>

<Pill active={aba === "caixa"} onClick={() => setAba("caixa")}>
  Caixa
</Pill>

<Pill active={aba === "historico"} onClick={() => setAba("historico")}>
  Histórico
</Pill>
        </div>
      </div>

      <div style={styles.content}>
        {aba === "mesas" ? (
          <div style={styles.grid3}>
            <div style={styles.card}>
              <SectionTitle title="Criar nova mesa" subtitle="Preencha e clique em Criar" />

              <div style={styles.field}>
                <label style={styles.label}>Número da mesa (ex: 10)</label>
                <input
                  style={styles.input}
                  value={mesaNumeroNovo}
                  onChange={(e) => setMesaNumeroNovo(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Ex: 10"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Nome opcional (ex: Família Silva)</label>
                <input
                  style={styles.input}
                  value={mesaNomeNovo}
                  onChange={(e) => setMesaNomeNovo(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <button style={styles.btnPrimary} onClick={criarMesa}>
                Criar
              </button>

              <div style={styles.hr} />

              <SectionTitle title="Pedido (Garçom)" subtitle="Selecione a mesa e monte o carrinho" />

              {mesaSelecionada ? (
                <div style={styles.selectedMesaBox}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={styles.selectedMesaTitle}>
                      Mesa {mesaSelecionada.numero}
                      {mesaSelecionada.nome ? ` • ${mesaSelecionada.nome}` : ""}
                    </div>

                    <Badge tone={String(mesaSelecionada.status).toLowerCase() === "aberta" ? "green" : "gray"}>
                      {mesaSelecionada.status}
                    </Badge>
                  </div>

                  <div style={styles.selectedMesaSub}>Adicione itens no cardápio e clique em “Enviar pedido”.</div>
                </div>
              ) : (
                <EmptyState title="Nenhuma mesa selecionada" desc="Selecione uma mesa na lista ao lado." />
              )}

              <div style={styles.field}>
                <label style={styles.label}>Observação (opcional)</label>
                <textarea
                  style={styles.textarea}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: sem cebola / bem passado / etc."
                />
              </div>

              <div style={styles.cartBox}>
                <div style={styles.cartTitleRow}>
                  <div style={styles.cartTitle}>Carrinho</div>
                  <div style={styles.cartTotal}>{brl(totalCarrinho)}</div>
                </div>

                {carrinho.length === 0 ? (
                  <div style={styles.cartEmpty}>Nenhum item ainda.</div>
                ) : (
                  <div style={styles.cartList}>
                    {carrinho.map((item) => (
                      <div key={item.produto.id} style={styles.cartItem}>
                        <div style={{ flex: 1 }}>
                          <div style={styles.cartItemName}>{item.produto.nome}</div>
                          <div style={styles.cartItemSub}>
                            {brl(item.preco_unitario)} •{" "}
                            <Badge tone={item.setor === "bar" ? "blue" : "yellow"}>{item.setor.toUpperCase()}</Badge>
                          </div>
                        </div>

                        <div style={styles.qtyWrap}>
                          <button
                            style={styles.qtyBtn}
                            onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)}
                          >
                            −
                          </button>
                          <input
                            style={styles.qtyInput}
                            value={item.quantidade}
                            onChange={(e) => alterarQuantidade(item.produto.id, e.target.value)}
                          />
                          <button
                            style={styles.qtyBtn}
                            onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)}
                          >
                            +
                          </button>
                        </div>

                        <div style={styles.cartItemSubtotal}>{brl(item.subtotal)}</div>

                        <button style={styles.btnGhostDanger} onClick={() => removerDoCarrinho(item.produto.id)}>
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={styles.cartActions}>
                  <button style={styles.btnGhost} onClick={limparCarrinho} disabled={carrinho.length === 0}>
                    Limpar
                  </button>
                  <button
                    style={styles.btnSuccess}
                    onClick={enviarPedido}
                    disabled={!mesaSelecionada || carrinho.length === 0}
                  >
                    Enviar pedido
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <SectionTitle title="Mesas" subtitle="Selecione, reabra, feche ou exclua" />

              {loadingMesas ? (
                <div style={styles.loading}>Carregando mesas…</div>
              ) : mesasOrdenadas.length === 0 ? (
                <EmptyState title="Sem mesas" desc="Crie uma mesa para começar." />
              ) : (
                <div style={styles.list}>
                  {mesasOrdenadas.map((m) => {
                    const isSel = mesaSelecionada?.id === m.id;
                    const st = String(m.status || "").toLowerCase();
                    return (
                      <div key={m.id} style={{ ...styles.row, ...(isSel ? styles.rowActive : {}) }}>
                        <div style={{ flex: 1 }}>
                          <div style={styles.rowTitle}>
                            Mesa {m.numero} {m.nome ? <span style={styles.rowTitleMuted}>• {m.nome}</span> : null}
                          </div>
                          <div style={styles.rowSub}>
                            <Badge tone={st === "aberta" ? "green" : st === "fechada" ? "gray" : "neutral"}>
                              {m.status || "—"}
                            </Badge>
                            <span style={styles.dot}>•</span>
                            <span style={styles.rowSubText}>ID {m.id}</span>
                          </div>
                        </div>

                        <div style={styles.rowActions}>
                          <button style={styles.btnPrimarySmall} onClick={() => setMesaSelecionada(m)}>
                            Selecionar
                          </button>
                          <button style={styles.btnGhostSmall} onClick={() => reabrirMesa(m)}>
                            Reabrir
                          </button>
                          <button style={styles.btnGhostSmall} onClick={() => fecharMesa(m)}>
                            Fechar
                          </button>
                          <button style={styles.btnDangerSmall} onClick={() => excluirMesa(m)}>
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <SectionTitle title="Cardápio" subtitle="Clique em Adicionar (o sistema decide se vai pro Bar ou Cozinha)" />

              {loadingProdutos ? (
                <div style={styles.loading}>Carregando produtos…</div>
              ) : produtosOrdenados.length === 0 ? (
                <EmptyState title="Sem produtos" desc="Cadastre produtos no Supabase (tabela produtos)." />
              ) : (
                <div style={styles.menuList}>
                  {produtosOrdenados.map((p) => {
                    const setor = detectarSetorPorCategoria(p.categoria);
                    return (
                      <div key={p.id} style={styles.menuRow}>
                        <div style={{ flex: 1 }}>
                          <div style={styles.menuTitle}>{p.nome}</div>
                          <div style={styles.menuSub}>
                            <span style={styles.menuPrice}>{brl(p.preco)}</span>
                            <span style={styles.dot}>•</span>
                            <Badge tone={setor === "bar" ? "blue" : "yellow"}>{setor.toUpperCase()}</Badge>
                            {p.categoria ? (
                              <>
                                <span style={styles.dot}>•</span>
                                <span style={styles.menuCat}>{p.categoria}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <button style={styles.btnPrimarySmall} onClick={() => adicionarAoCarrinho(p)}>
                          Adicionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <SectionTitle title={aba === "cozinha" ? "Painel Cozinha" : "Painel Bar"} subtitle="Pedidos em tempo real" />

              <div style={styles.panelTopRow}>
                <button style={styles.btnGhost} onClick={carregarPainel}>
                  Atualizar
                </button>
                <div style={styles.panelHint}>Pendentes = status diferente de pronto/entregue/finalizado.</div>
              </div>

              {loadingPainel ? (
                <div style={styles.loading}>Carregando…</div>
              ) : itensPainel.length === 0 ? (
                <EmptyState title="Nada pendente" desc="Quando enviar pedido, ele aparece aqui automaticamente." />
              ) : (
                <div style={styles.panelList}>
                  {itensPainel.map((i) => {
                    const produtoNome = i?.produtos?.nome || `Produto #${i.produto_id}`;
                    const mesaNum = i?.pedidos?.mesa_numero ?? "—";
                    const status = String(i.status || "recebido");
                    const criado = i.created_at ? new Date(i.created_at).toLocaleString("pt-BR") : "";

                    return (
                      <div key={i.id} style={styles.panelItem}>
                        <div style={{ flex: 1 }}>
                          <div style={styles.panelItemTitle}>
                            Mesa {mesaNum} • {produtoNome} <span style={styles.panelQty}>x{i.quantidade}</span>
                          </div>

                          <div style={styles.panelItemSub}>
                            <Badge tone={aba === "bar" ? "blue" : "yellow"}>{String(i.setor).toUpperCase()}</Badge>
                            <span style={styles.dot}>•</span>
                            <Badge tone={status === "recebido" ? "neutral" : status === "pronto" ? "green" : "gray"}>
                              {status}
                            </Badge>
                            <span style={styles.dot}>•</span>
                            <span style={styles.panelTime}>{criado}</span>
                          </div>

                          {i.observacao ? <div style={styles.panelObs}>Obs: {i.observacao}</div> : null}
                        </div>

                        <div style={styles.panelActions}>
                          <button style={styles.btnSuccessSmall} onClick={() => marcarItemComoPronto(i.id)}>
                            Marcar pronto
                          </button>
                          <button style={styles.btnDangerSmall} onClick={() => cancelarItem(i.id)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <SectionTitle title="Resumo" subtitle="Visão rápida" />

              <div style={styles.summaryBox}>
                <div style={styles.summaryRow}>
                  <div style={styles.summaryLabel}>Itens pendentes ({aba})</div>
                  <div style={styles.summaryValue}>{itensPainel.length}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryLabel}>Mesas cadastradas</div>
                  <div style={styles.summaryValue}>{mesas.length}</div>
                </div>

                <div style={styles.summaryRow}>
                  <div style={styles.summaryLabel}>Produtos ativos</div>
                  <div style={styles.summaryValue}>{produtos.length}</div>
                </div>

                <div style={styles.hr} />

                <div style={styles.tipBox}>
                  <div style={styles.tipTitle}>Dica ✅</div>
                  <div style={styles.tipText}>
                    BAR x COZINHA depende de <b>produtos.categoria</b>. Bebidas (água, refri, cerveja, dose) vão pro BAR,
                    resto vai pra COZINHA.
                  </div>
                </div>
              </div>

              <div style={{ height: 10 }} />

              <button style={styles.btnGhost} onClick={() => setAba("mesas")}>
                Voltar para Mesas
              </button>
            </div>
          </div>
        )}
      </div>
      ,{aba === "caixa" && (

<div style={{padding:"20px"}}>

<h2>Caixa</h2>

{pedidosCaixa.length === 0 && (
<div>Nenhuma mesa aberta</div>
)}

{pedidosCaixaAgrupados.map((pedido) => (

<div key={pedido.mesa_numero} style={{
border:"1px solid #ddd",
borderRadius:"10px",
padding:"15px",
marginBottom:"20px",
background:"#fff"
}}>

<h3>Mesa {pedido.mesa_numero}</h3>

<div style={{marginTop:"10px"}}>

{pedido.itens.map((item,i)=>(
<div key={i}>
{item.quantidade}x {item.produtos?.nome}
 — R$ {item.preco_unitario}
</div>
))}

</div>

<h3 style={{marginTop:"10px"}}>
Total: {brl(pedido.total)}
</h3>

<div style={{display:"flex",gap:"10px",marginTop:"10px"}}>

<button onClick={()=>fecharConta(pedido,"dinheiro")}>
💵 Dinheiro
</button>

<button onClick={()=>fecharConta(pedido,"cartao")}>
💳 Cartão
</button>

<button onClick={()=>fecharConta(pedido,"pix")}>
📱 Pix
</button>

</div>

</div>

))}

</div>

)}
{aba === "historico" && (
  <div style={{ padding: "20px" }}>
    <h2>Histórico / Administrativo</h2>

    <div style={{ marginBottom: "15px" }}>
      <strong>Total dinheiro:</strong> {brl(totalDinheiro)}
    </div>

    <div style={{ marginBottom: "15px" }}>
      <strong>Total cartão:</strong> {brl(totalCartao)}
    </div>

    <div style={{ marginBottom: "15px" }}>
      <strong>Total pix:</strong> {brl(totalPix)}
    </div>

    <div style={{ marginBottom: "20px" }}>
      <strong>Total geral:</strong> {brl(totalGeralHistorico)}
    </div>

    <button onClick={carregarHistorico}>
      Atualizar histórico
    </button>

    <div style={{ marginTop: "20px" }}>
      {historicoAgrupado.map((m) => (
  <div
    key={m.mesa}
    style={{
      padding: "12px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      marginBottom: "10px",
      background: "#fafafa"
    }}
  >

    <strong>Mesa {m.mesa}</strong>

    <div>
      Pedidos: {m.pedidos}
    </div>

    <div>
      Pagamentos: {[...m.pagamentos].join(", ")}
    </div>

    <div>
      Total: <strong>{brl(m.total)}</strong>
    </div>

  </div>
))}
    </div>
  </div>
)}
    </div>

  );
}

/**
 * ============================================================
 *  STYLES (UM ÚNICO styles)
 * ============================================================
 */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    color: "#111827",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
  },
  header: {
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderBottom: "1px solid #e5e7eb",
    background: "#ffffff",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 12 },
  brandLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "#111827",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  brandTitle: { fontSize: 18, fontWeight: 800, lineHeight: 1.2 },
  brandSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  pill: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    transition: "all .2s ease",
  },
  pillActive: { background: "#111827", color: "white", borderColor: "#111827" },
  pillInactive: { background: "#fff", color: "#111827" },

  content: { padding: 18 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  grid2: {
  display: "grid",
  gridTemplateColumns: window.innerWidth < 900 ? "1fr" : "2fr 1fr",
  gap: 16
},

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 6px 18px rgba(17,24,39,.06)",
    minHeight: 80,
  },

  sectionTitleWrap: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 900 },
  sectionSubtitle: { marginTop: 3, fontSize: 12, color: "#6b7280" },

  field: { marginBottom: 12 },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    outline: "none",
    fontSize: 14,
    minHeight: 80,
    resize: "vertical",
  },

  btnPrimary: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnSuccess: {
    padding: "11px 14px",
    borderRadius: 12,
    border: "none",
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnGhost: {
    padding: "11px 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnGhostDanger: {
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnPrimarySmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },
  btnGhostSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },
  btnDangerSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "none",
    background: "#dc2626",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },
  btnSuccessSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "none",
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },

  hr: { height: 1, background: "#e5e7eb", margin: "14px 0" },

  list: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" },
  rowActive: { borderColor: "#111827", boxShadow: "0 0 0 3px rgba(17,24,39,.08)" },
  rowTitle: { fontWeight: 900, fontSize: 14 },
  rowTitleMuted: { color: "#6b7280", fontWeight: 700 },
  rowSub: { marginTop: 4, fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  rowSubText: { color: "#6b7280" },
  dot: { color: "#9ca3af" },
  rowActions: { display: "flex", gap: 8, flexWrap: "wrap" },

  selectedMesaBox: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#f9fafb", marginBottom: 12 },
  selectedMesaTitle: { fontWeight: 900, fontSize: 14 },
  selectedMesaSub: { marginTop: 6, fontSize: 12, color: "#6b7280" },

  menuList: { display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflow: "auto", paddingRight: 4 },
  menuRow: { display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" },
  menuTitle: { fontWeight: 900, fontSize: 14 },
  menuSub: { marginTop: 4, fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  menuPrice: { fontWeight: 900, color: "#111827" },
  menuCat: { color: "#6b7280" },

  cartBox: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" },
  cartTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cartTitle: { fontWeight: 900, fontSize: 14 },
  cartTotal: { fontWeight: 900, fontSize: 14, color: "#111827" },
  cartEmpty: { fontSize: 12, color: "#6b7280", padding: "6px 0" },
  cartList: { display: "flex", flexDirection: "column", gap: 10 },
  cartItem: { display: "flex", gap: 10, alignItems: "center", borderTop: "1px dashed #e5e7eb", paddingTop: 10 },
  cartItemName: { fontWeight: 900, fontSize: 13 },
  cartItemSub: { marginTop: 4, fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cartItemSubtotal: { width: 110, textAlign: "right", fontWeight: 900, fontSize: 12 },

  qtyWrap: { display: "flex", alignItems: "center", gap: 6 },
  qtyBtn: { width: 32, height: 32, borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 900, cursor: "pointer" },
  qtyInput: { width: 44, height: 32, borderRadius: 10, border: "1px solid #e5e7eb", textAlign: "center", fontWeight: 900 },

  cartActions: { marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10 },

  badge: { padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 900, border: "1px solid transparent", display: "inline-flex", alignItems: "center", gap: 6 },
  badgeNeutral: { background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" },
  badgeGreen: { background: "#dcfce7", color: "#166534", borderColor: "#86efac" },
  badgeRed: { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" },
  badgeBlue: { background: "#dbeafe", color: "#1e40af", borderColor: "#bfdbfe" },
  badgeYellow: { background: "#fef9c3", color: "#854d0e", borderColor: "#fde68a" },
  badgeGray: { background: "#f3f4f6", color: "#374151", borderColor: "#e5e7eb" },

  loading: { fontSize: 13, color: "#6b7280", padding: "10px 0" },
  emptyWrap: { padding: "14px 0" },
  emptyTitle: { fontWeight: 900, fontSize: 14 },
  emptyDesc: { marginTop: 4, color: "#6b7280", fontSize: 12 },

  panelTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  panelHint: { color: "#6b7280", fontSize: 12 },

  panelList: { display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflow: "auto", paddingRight: 4 },
  panelItem: { display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" },
  panelItemTitle: { fontWeight: 900, fontSize: 14 },
  panelQty: { color: "#111827", fontWeight: 900, marginLeft: 6 },
  panelItemSub: { marginTop: 6, fontSize: 12, color: "#6b7280", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  panelTime: { color: "#6b7280" },
  panelObs: { marginTop: 8, fontSize: 12, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", padding: 10, borderRadius: 12 },
  panelActions: { display: "flex", gap: 8, flexWrap: "wrap" },

  summaryBox: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px dashed #e5e7eb" },
  summaryLabel: { fontSize: 12, color: "#6b7280", fontWeight: 800 },
  summaryValue: { fontSize: 14, fontWeight: 900 },

  tipBox: { marginTop: 10, borderRadius: 14, border: "1px solid #e5e7eb", padding: 12, background: "#f9fafb" },
  tipTitle: { fontWeight: 900, marginBottom: 6 },
  tipText: { fontSize: 12, color: "#374151", lineHeight: 1.5 },

  toastWrap: { position: "fixed", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 9999, padding: "0 14px", cursor: "pointer" },
  toast: { width: "min(640px, 100%)", borderRadius: 14, padding: 12, boxShadow: "0 12px 30px rgba(0,0,0,.18)", border: "1px solid transparent", background: "#fff" },
  toastOk: { borderColor: "#bbf7d0" },
  toastError: { borderColor: "#fecaca" },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastMessage: { marginTop: 4, fontSize: 12, color: "#6b7280" },
};