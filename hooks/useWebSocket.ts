import { useEffect } from "react"
import { useAuth } from "./useAuth"
import { wsClient } from "@/lib/ws"

export function useWebSocket() {
  const { user, token, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated && user?.id && token) {
      wsClient.connect(user.id, token)
    }
    return () => {
      // Keep connection active unless logout
    }
  }, [isAuthenticated, user?.id, token])
}
