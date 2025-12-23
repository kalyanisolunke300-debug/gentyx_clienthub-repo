// //app/login/page.tsx
// "use client";

// import React, { useState } from "react";
// import "./login.css"; // Use original AccountHub CSS
// import { Eye, EyeOff } from "lucide-react";
// import { useRouter } from "next/navigation";
// import { useToast } from "@/hooks/use-toast";
// import { useUIStore } from "@/store/ui-store"; // ← Zustand store

// export default function LoginPage() {
//   const router = useRouter();
//   const { toast } = useToast();

//   // Zustand role setter
//   const setUIRole = useUIStore((state) => state.setRole);

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();

//     if (!email || !password) {
//       toast({
//         title: "Error",
//         description: "Email and password are required",
//         variant: "destructive",
//       });
//       return;
//     }

//     setLoading(true);

//     try {
//       const res = await fetch("/api/login", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await res.json();

//       if (!data.success) {
//         toast({
//           title: "Login Failed",
//           description: data.message || "Invalid credentials",
//           variant: "destructive",
//         });
//         return;
//       }

//       const role = data.user.role;

//       // 🔥 FIX: Reset previous role FIRST
//       setUIRole(null);

//       // 🔥 FIX: Set the new role from DB
//       setUIRole(role);

//       const dashboardMap: Record<string, string> = {
//         ADMIN: "/admin",
//         CLIENT: "/client",
//         SERVICE_CENTER: "/service-center",
//         CPA: "/cpa",
//       };

//       router.push(dashboardMap[role] || "/admin");
//     } catch (error) {
//       toast({
//         title: "Error",
//         description: "Something went wrong. Try again later.",
//         variant: "destructive",
//       });
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="login-page">
//       {/* TOP LOGO */}
//       <div className="logo-wrapper">
//         <img
//           src="/images/legacytest.png"
//           //src="/images/sage_healthy_rcm_logo.png"   # sage logo replaced
//           alt="mySAGE Logo"
//           className="mysage-logo"
//         />
//       </div>

//       {/* LOGIN BOX */}
//       <div className="login-box">
//         <img
//           src="/images/clienthublogin.png"
//           alt="AccountsHub"
//           className="login-logo-img"
//         />

//         <form onSubmit={handleSubmit} style={{ width: "100%" }}>
//           <label>Email Address</label>
//           <input
//             type="email"
//             placeholder="user@example.com"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />

//           <label>Password</label>

//           <div className="password-field">
//             <input
//               type={showPassword ? "text" : "password"}
//               placeholder="********"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               required
//             />

//             <button
//               type="button"
//               className="password-visibility-btn"
//               onClick={() => setShowPassword((prev) => !prev)}
//             >
//               {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//             </button>
//           </div>

//           <button type="submit" className="login-btn" disabled={loading}>
//             {loading ? "Logging in..." : "LOG IN"}
//           </button>
//         </form>
//       </div>

//       {/* FOOTER TEXT */}
//       <div className="powered-by-text">POWERED BY HUBONE SYSTEMS</div>
//       <p className="footer-text">
//         © 2014–2025 HubOne Systems Inc. – All Rights Reserved
//       </p>
//     </div>
//   );
// }
//app/login/page.tsx
"use client";

import React, { useState } from "react";
import "./login.css"; // Use original AccountHub CSS
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/store/ui-store"; // ← Zustand store

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Zustand role setter
  const setUIRole = useUIStore((state) => state.setRole);
  const setCurrentClientId = useUIStore((state) => state.setCurrentClientId)

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      console.log("🔍 LOGIN API RESPONSE:", data);

      if (!data.success) {
        toast({
          title: "Login Failed",
          description: data.message || "Invalid credentials",
          variant: "destructive",
        });
        return;
      }

      const role = data.user.role;
      const clientId = data.user.clientId;

      console.log("🔍 LOGIN - role:", role);
      console.log("🔍 LOGIN - clientId from API:", clientId);

      // 🔥 RESET STORE FIRST
      setUIRole(null);
      setCurrentClientId(undefined);

      // 🔥 SET ROLE
      setUIRole(role);

      // 🔥 SET CLIENT ID FOR CLIENT ROLE
      if (role === "CLIENT" && clientId) {
        console.log("🔍 LOGIN - Setting currentClientId to:", clientId.toString());
        setCurrentClientId(clientId.toString());
      }

      const dashboardMap: Record<string, string> = {
        ADMIN: "/admin",
        CLIENT: "/client",
        SERVICE_CENTER: "/service-center",
        CPA: "/cpa",
      };

      // Small delay to ensure Zustand persists to localStorage
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log("🔍 LOGIN - Navigating to:", dashboardMap[role] || "/admin");
      router.push(dashboardMap[role] || "/admin");
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* TOP LOGO */}
      <div className="logo-wrapper">
        <img
          src="/images/legacytest.png"
          //src="/images/sage_healthy_rcm_logo.png"   # sage logo replaced
          alt="mySAGE Logo"
          className="mysage-logo"
        />
      </div>

      {/* LOGIN BOX */}
      <div className="login-box">
        <img
          src="/images/clienthublogin.png"
          alt="AccountsHub"
          className="login-logo-img"
        />

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <label>Email Address</label>
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="password-visibility-btn"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "LOG IN"}
          </button>
        </form>
      </div>

      {/* FOOTER TEXT */}
      <div className="powered-by-text">POWERED BY HUBONE SYSTEMS</div>
      <p className="footer-text">
        © 2014–2025 HubOne Systems Inc. – All Rights Reserved
      </p>
    </div>
  );
}