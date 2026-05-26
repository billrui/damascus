import { io } from "socket.io-client";

const BASE = "http://localhost:3001";

async function test() {
  // 1. Login as waiter
  console.log("1. Logging in as Waiter...");
  const wRes  = await fetch(BASE+"/api/auth/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user_id:13, pin:"1313" })
  });
  const wData = await wRes.json();
  console.log("Waiter login:", wRes.status, wData.user?.name ?? wData);
  const wToken = wData.access_token;

  // 2. Login as kitchen
  console.log("2. Logging in as kitchen...");
  const kRes  = await fetch(BASE+"/api/auth/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user_id:14, pin:"1414" })
  });
  const kData = await kRes.json();
  console.log("Kitchen login:", kRes.status, kData.user?.name ?? kData);
  const kToken = kData.access_token;

  if (!wToken || !kToken) { console.log("LOGIN FAILED"); process.exit(1); }

  // 3. Connect kitchen socket
  console.log("3. Connecting kitchen socket...");
  const kSocket = io(BASE, { auth:{ token:kToken }, transports:["websocket"] });

  kSocket.on("connect_error", (e) => {
    console.log("Kitchen socket error:", e.message);
    process.exit(1);
  });

  kSocket.on("connect", async () => {
    console.log("Kitchen socket connected:", kSocket.id);

    kSocket.on("hold:created", (hold) => {
      console.log("SUCCESS - Kitchen received hold:", JSON.stringify(hold, null, 2));
      process.exit(0);
    });

    // 4. Create hold as waiter
    console.log("4. Creating hold as waiter...");
    const hRes  = await fetch(BASE+"/api/pos/holds", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+wToken },
      body: JSON.stringify({
        table_no: "T1",
        items: [{ menuId:"1", name:"Burger", qty:1, price:500, emoji:"", note:"test" }],
        total: 500,
        notes: "Waiter: Waiter"
      })
    });
    const hData = await hRes.json();
    console.log("Hold response:", hRes.status, JSON.stringify(hData));
  });

  setTimeout(() => {
    console.log("TIMEOUT - hold:created never received by kitchen");
    process.exit(1);
  }, 8000);
}

test().catch(console.error);
