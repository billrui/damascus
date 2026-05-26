import { io } from "socket.io-client";
const BASE = "http://localhost:3001";
async function test() {
  const wRes = await fetch(BASE+"/api/auth/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user_id:13, pin:"1313" })
  });
  const wData = await wRes.json();
  console.log("Waiter login:", wRes.status, wData.user?.name ?? wData);
  const wToken = wData.access_token;

  const kRes = await fetch(BASE+"/api/auth/login", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user_id:14, pin:"1414" })
  });
  const kData = await kRes.json();
  console.log("Kitchen login:", kRes.status, kData.user?.name ?? kData);
  const kToken = kData.access_token;

  const kSocket = io(BASE, { auth:{ token:kToken }, transports:["websocket"] });
  kSocket.on("connect_error", (e) => { console.log("Socket error:", e.message); process.exit(1); });
  kSocket.on("connect", async () => {
    console.log("Kitchen socket connected:", kSocket.id);
    kSocket.on("hold:created", (hold) => {
      console.log("SUCCESS - Kitchen received hold!");
      console.log("  table:", hold.table_no, "waiter:", hold.waiter_name);
      console.log("  items:", JSON.stringify(hold.items));
      process.exit(0);
    });
    const hRes = await fetch(BASE+"/api/pos/holds", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+wToken },
      body: JSON.stringify({
        table_no: "T1",
        items: [{ menu_item_id:"1", name:"Burger", qty:1, price:500 }],
        total: 500,
        notes: "test"
      })
    });
    const hData = await hRes.json();
    console.log("Hold response:", hRes.status, JSON.stringify(hData));
  });
  setTimeout(() => { console.log("TIMEOUT"); process.exit(1); }, 8000);
}
test().catch(console.error);
