const fs = require('fs');
let code = fs.readFileSync('components/chat/LedgerSettingsFull.tsx', 'utf8');

const replaceStr = `              {/* Linked Devices */}
              <Group title="Linked Devices" footer="Link another device exactly like WhatsApp Web.">
                <Row
                  icon={<Smartphone size={18} />}
                  label="Link a Device"
                  sublabel="Connect your phone or desktop via QR"
                  onTap={() => { setQrScanMode('scan'); setModal('linked_devices'); }}
                />
                <Row
                  icon={<Monitor size={18} />}
                  label="This Device (Primary)"
                  sublabel="Active now"
                  value="Active"
                />
              </Group>`;

const start = code.indexOf('Linked Devices - QR Phone Linking');
if (start > -1) {
  const lineStart = code.lastIndexOf('\n', start);
  const end = code.indexOf('</Group>', start) + '</Group>'.length;
  if (end > start) {
    code = code.substring(0, lineStart) + '\n' + replaceStr + code.substring(end);
    fs.writeFileSync('components/chat/LedgerSettingsFull.tsx', code);
    console.log('Fixed');
  } else { console.log('End not found'); }
} else {
  console.log('Not found');
}
