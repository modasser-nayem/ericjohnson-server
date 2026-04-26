export const withAck = async <T>(
   fn: () => Promise<T>,
   ack?: (payload: { success: boolean; data?: T; message?: string }) => void,
) => {
   try {
      const result = await fn();
      ack && ack({ success: true, data: result });
   } catch (err: any) {
      ack && ack({ success: false, message: err.message });
   }
};
