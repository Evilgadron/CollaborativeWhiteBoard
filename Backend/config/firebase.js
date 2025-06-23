const admin = require('firebase-admin');

const serviceAccount = {
  "type": "service_account",
  "project_id": "syncwave-17a8c",
  "private_key_id": "009aaa77c74db136329d14417b1f9d5e08c330ad",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCz1x4bT/g1bDzp\niJjQzIelWKpNLCj5eU5rPfULkc4mGI1x0Hk21v/z3548/n3KnFmh+JhdchASqnGT\nZOU54DApBMOkAyv9Hm16XzM1VHysMm1d36GahwS4Vn4dUdcxKjHmN3brC/d/EgMQ\nqPtmIvcCvnTLAsf3/q86DPBZjZBXaN4khtfIMDieQfVgvxkwj4R+9CFUy3cIB47I\nUVwwNAP6XXiqkinfuMLqL38Y6LmKINGgIAJxVGnJYi+jJup5aTeyWmlqukidon6a\ntKEbksZlRmw26reP/Olz2+bSMXVx4rXYIMzT4AhC5WRtxT3yy9TAZLfmkCCjl+op\nWfFerrX7AgMBAAECggEABwOQzQflak/6YDFPpHUVpUE8Ax6BypkMkeossHLTU3EJ\nszKqR5VDDkPebAqQ5WILrOGBL8PPFKtJGrKIriUsO61P5AmroYeaRXeJC79rzVt6\nIHskVl6FtJrK+GHEvsoigBQRs0EYOgB91hyBEY6zi4vaCkDlg6qPMvhmN1fqFT6V\nDYG9EOGy0f1aK3hp8q+XABhezXZnXfLVCThyODj3+vDKnkMze0qCy7SIE64fQEty\nPMhmun5W/QIsP1Sa22ClaMUnkjNlaD54oxMMXi1mfA/PrVE0aAREDPdWWR1Xja+O\nBZ43RtUuOMgT7fCmMtmoP2X4wXYc1FbTbFoMhjvzoQKBgQDbw1BhoPiPxUcJT+Op\nWFwYS7XL1NMtzDA8Boh8shvjZNyhFBdrEspKWIA7ZY56WvNSAU520Yv7F/wAGK32\nXBptnzy3QdCpsxeHMVODI4aS32iZRD0Nd7lp3daHZXFl7rOZ5QKevvkE55uRRJF9\nXlsRvdkYXyWPb554uooEgPVFTwKBgQDRfpRZ2NGHoHmBBC3S46o9W8UOAUBQz3Or\nSj/qPhNMqXURX2lX/Zu7pvw02zHkAAjJtpeA6v5eVSOOVrTUEPAprrPlgSdbPxZL\nyfY0ro5Woa4s+c0kKdLqbgUKcmPZhnp0xWw2Y8eonlz70pvmsH+s3qrbR23xgiGH\njLYyi/LxlQKBgEnzFkhT53BRnQ7IID6q6gqO53TYf9toW07HkAQN1w6UsR1O6nZw\nUzvjPfs+uEv58OjGYcXfy2/J6VWK+HbvFUGQFNlBv1prVl56vbRiLvWbUdJJQRYY\nFH9IU9kpzJfVVABULKaIcrkwyot+fEqohpKYxMXLtpLmp3fOpYTQdDhHAoGADhtE\n6AvmiAhxRhO+9i1oYDtWuIuzBf4CHu2gAijt6cKbZHEVSdyE6QzkfLap1F2AOfz2\nlLK+MCHxg/sosAL3+QaPjIu217kWykGuN3vtj73RWav0eVPrpOeFpV9wg8w/YK+O\nitcLMbqALmDPKKiH4F8aCCv2JkYJ9fOurRapZEUCgYBvOJCs/D/GSbNhOQPyeDdy\nl9wp/e0AG1+BICBzI5ASB+slNFe4WSjXVOXH7blQwjRjwj2B109d1lKCYJOnBYPk\nVqEBWUT//4TMkyQfYH1todxVF4Mvcr+9+JNERwRW9RiQ6kYj0iK1416L2I2Be1WG\nhCHF2Khe+CbT+hiESY2klA==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@syncwave-17a8c.iam.gserviceaccount.com",
  "client_id": "114917388405969147538",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40syncwave-17a8c.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'syncwave-17a8c.firebasestorage.app'
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };