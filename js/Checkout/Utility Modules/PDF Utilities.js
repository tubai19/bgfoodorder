// utils/pdf.js
export function generatePDFBill(orderDetails) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Header section
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text('Bake & Grill', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Delicious food delivered to your doorstep', 105, 28, { align: 'center' });
  
  // Order title
  doc.setFontSize(16);
  doc.setTextColor(157, 78, 223);
  doc.text('ORDER RECEIPT', 105, 40, { align: 'center' });
  
  // Order details
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(`Order #: ${orderDetails.id || Math.floor(100000 + Math.random() * 900000)}`, 15, 50);
  doc.text(`Date: ${new Date(orderDetails.timestamp).toLocaleString()}`, 15, 58);
  doc.text(`Customer: ${orderDetails.customerName}`, 15, 66);
  doc.text(`Phone: ${orderDetails.phoneNumber}`, 15, 74);
  doc.text(`Order Type: ${orderDetails.orderType}`, 15, 82);
  
  // Delivery details if applicable
  if (orderDetails.orderType === 'Delivery') {
    if (orderDetails.deliveryLocation) {
      doc.text(`Location: ${orderDetails.deliveryLocation.latitude}, ${orderDetails.deliveryLocation.longitude}`, 15, 90);
    } else if (orderDetails.deliveryAddress) {
      doc.text(`Address: ${orderDetails.deliveryAddress}`, 15, 90);
    }
    doc.text(`Distance: ${orderDetails.deliveryDistance ? orderDetails.deliveryDistance.toFixed(1)+'km' : 'Unknown'}`, 15, 98);
  }
  
  // Order items table
  doc.autoTable({
    startY: 120,
    head: [['#', 'Item', 'Variant', 'Qty', 'Price (₹)']],
    body: orderDetails.items.map((item, index) => [
      index + 1,
      item.name,
      item.variant,
      item.quantity,
      item.price * item.quantity
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [157, 78, 223],
      textColor: [255, 255, 255]
    },
    styles: {
      cellPadding: 5,
      fontSize: 10
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 60 },
      2: { cellWidth: 40 },
      3: { cellWidth: 20 },
      4: { cellWidth: 30 }
    }
  });
  
  // Calculate final Y position after table
  const finalY = doc.lastAutoTable.finalY + 10;
  
  // Pricing summary
  doc.setFontSize(12);
  doc.text(`Subtotal: ₹${orderDetails.subtotal}`, 140, finalY);
  
  if (orderDetails.deliveryCharge > 0) {
    doc.text(`Delivery Charge: ₹${orderDetails.deliveryCharge}`, 140, finalY + 8);
  } else if (orderDetails.orderType === 'Delivery') {
    doc.text(`Delivery Charge: Free`, 140, finalY + 8);
  }
  
  // Total amount
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Amount: ₹${orderDetails.total}`, 140, finalY + 20);
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your order!', 105, 280, { align: 'center' });
  doc.text('For any queries, contact: +91 8240266267', 105, 285, { align: 'center' });
  
  // Save the PDF
  doc.save(`BakeAndGrill_Order_${orderDetails.customerName.replace(/\s+/g, '_')}.pdf`);
}

// Additional PDF utility functions can be added here
export function generateSimpleReceipt(orderData) {
  // Alternative simpler receipt format
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(157, 78, 223);
  doc.text('Bake & Grill - Order Receipt', 105, 20, { align: 'center' });
  
  // Order info
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Order #: ${orderData.id || 'N/A'}`, 20, 40);
  doc.text(`Date: ${new Date(orderData.timestamp).toLocaleString()}`, 20, 50);
  
  // Items list
  let yPos = 70;
  doc.text('Items:', 20, yPos);
  yPos += 10;
  
  orderData.items.forEach(item => {
    doc.text(`- ${item.name} (${item.variant}) x${item.quantity} - ₹${item.price * item.quantity}`, 25, yPos);
    yPos += 7;
  });
  
  // Total
  yPos += 10;
  doc.text(`Subtotal: ₹${orderData.subtotal}`, 20, yPos);
  if (orderData.deliveryCharge > 0) {
    doc.text(`Delivery: ₹${orderData.deliveryCharge}`, 20, yPos + 10);
    doc.text(`Total: ₹${orderData.total}`, 20, yPos + 20);
  } else {
    doc.text(`Total: ₹${orderData.total}`, 20, yPos + 10);
  }
  
  doc.save(`BakeAndGrill_Receipt_${orderData.customerName.replace(/\s+/g, '_')}.pdf`);
}