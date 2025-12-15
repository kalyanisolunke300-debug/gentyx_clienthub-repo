"use client"

import * as React from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light"
    return (localStorage.getItem("theme") as "light" | "dark") || "light"
  })

  React.useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") root.classList.add("dark")
    else root.classList.remove("dark")
    localStorage.setItem("theme", theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export const ThemeContext = React.createContext<{ theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void }>({
  theme: "light",
  setTheme: () => {},
})
