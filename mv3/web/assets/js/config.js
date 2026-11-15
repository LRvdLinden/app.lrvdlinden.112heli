// Instellingen van MV3. Pas hier aan zonder de rest te wijzigen.
window.MV3_CONFIG = {
  // De server van 112Heli (Cloudflare Worker); MV3 gebruikt dezelfde gegevens.
  api: "https://112heli-api.112heli.workers.dev",
  // Het toestel: Dassault Falcon 8X PH-UTL (ICAO 4867E6).
  hex: "4867e6",
  // Hoe vaak de positie wordt opgehaald (de server ververst elke minuut).
  pollSeconds: 20,
};
