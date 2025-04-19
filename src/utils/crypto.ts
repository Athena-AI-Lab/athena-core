import crypto from "crypto";
import fs from "fs";

export const fileDigest = async (
  filePath: string,
  algorithm: string = "sha256",
) => {
  return new Promise<string>((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    fs.createReadStream(filePath)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });
};
