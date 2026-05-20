import { useEffect, useState } from "react";
import { errorMessage } from "../lib/errors";
import { loadRoutineData } from "../lib/routine";
import type { RoutineData } from "../types";

export function useRoutineData() {
  const [routineData, setRoutineData] = useState<RoutineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    loadRoutineData()
      .then((data) => {
        if (mounted) setRoutineData(data);
      })
      .catch((error) => {
        if (mounted) setError(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { routineData, loading, error };
}
