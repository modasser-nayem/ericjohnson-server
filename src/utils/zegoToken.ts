import crypto from "crypto";

export function generateToken04(
   appId: number,
   userId: string,
   secret: string,
   effectiveTimeInSeconds: number,
   payload?: object,
) {
   const createTime = Math.floor(Date.now() / 1000);
   const expire = createTime + effectiveTimeInSeconds;

   const nonce = Math.floor(Math.random() * 2147483647);

   const payloadStr = JSON.stringify({
      ...payload,
   });

   const tokenData = {
      app_id: appId,
      user_id: userId,
      nonce,
      ctime: createTime,
      expire,
      payload: payloadStr,
   };

   const jsonStr = JSON.stringify(tokenData);

   const iv = crypto.randomBytes(16);

   const key = crypto.createHash("md5").update(secret).digest(); // ✅ correct 16-byte key

   const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
   const encrypted = Buffer.concat([
      cipher.update(jsonStr, "utf8"),
      cipher.final(),
   ]);

   const buffer = Buffer.alloc(16 + 2 + encrypted.length);
   iv.copy(buffer, 0);
   buffer.writeUInt16BE(encrypted.length, 16);
   encrypted.copy(buffer, 18);

   return "04" + buffer.toString("base64");
}
