"use client";

import { useEffect, useState } from "react";
import type { Cortes } from "./types";
import { CORTES_PADRAO } from "./score";

const STORAGE_KEY = "radar.cortes";

function validar(c: unknown): c is Cortes {
  if (!c || typeof c !== "object") return false;
  const { morno, quente } = c as Record<string, unknown>;
  return (
    typeof morno === "number" &&
    typeof quente === "number" &&
    isFinite(morno) &&
    isFinite(quente) &&
    morno >= 0 &&
    quente <= 100 &&
    morno <= quente
  );
}

export function useCortes() {
  const [cortes, setCortesState] = useState<Cortes>(CORTES_PADRAO);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (validar(parsed)) setCortesState(parsed);
      }
    } catch {
      // localStorage indisponível ou JSON inválido — mantém padrão
    }
    setHidratado(true);
  }, []);

  function setCortes(c: Cortes) {
    setCortesState(c);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      // ignora falha de storage
    }
  }

  return { cortes, setCortes, hidratado };
}
