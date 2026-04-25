export const withAck = async (fn: Function, ack?: Function) => {
   try {
      const result = await fn();
      ack && ack({ success: true, data: result });
   } catch (err: any) {
      ack && ack({ success: false, message: err.message });
   }
};
