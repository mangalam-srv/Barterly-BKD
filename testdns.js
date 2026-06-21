import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

console.log("Servers:", dns.getServers());

dns.resolveSrv(
  "_mongodb._tcp.cluster0.lnsehgx.mongodb.net",
  (err, addresses) => {
    console.log("ERR:", err);
    console.log("ADDRESSES:", addresses);
  }
);