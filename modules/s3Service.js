
require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// S3 클라이언트 설정
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3에 파일 업로드 함수
const uploadFileToS3 = async (fileName, fileContent, dojang_code) => {
  const bucketName = process.env.AWS_BUCKET_NAME || 'mydojangbucket';
  const region = process.env.AWS_REGION || 'us-east-2';

  const params = {
    Bucket: bucketName,
    Key: `uploads/${dojang_code}/${fileName}`,
    Body: fileContent,
  };

  const command = new PutObjectCommand(params);

  try {
    await s3Client.send(command);
    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${params.Key}`;
    console.log("Generated S3 URL:", fileUrl);
    return fileUrl;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};

// S3에서 파일 삭제 함수
const deleteFileFromS3 = async (fileName, dojang_code) => {
  const bucketName = process.env.AWS_BUCKET_NAME || 'mydojangbucket';

  const params = {
    Bucket: bucketName,
    Key: `uploads/${dojang_code}/${fileName}`,
  };

  const command = new DeleteObjectCommand(params);

  try {
    await s3Client.send(command);
    console.log(`Deleted file: ${fileName} from bucket: ${bucketName}`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw error;
  }
};

module.exports = {
  uploadFileToS3,
  deleteFileFromS3,
};
