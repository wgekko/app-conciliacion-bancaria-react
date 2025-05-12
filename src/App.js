import React, { useState, useCallback } from 'react';
import { UploadCloud, FileDown, AlertTriangle, RotateCcw, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const XLSX = window.XLSX;

// Componente para el input de archivo estilizado
const StyledFileInput = ({ id, label, onFileChange, fileName, processing }) => (
  <div className="w-full md:w-1/2 px-2 mb-4 md:mb-0">
    <label htmlFor={id} className="block text-sm font-semibold text-gray-300 mb-2">{label}</label>
    <div className={`relative border-2 border-dashed border-gray-600 rounded-lg p-6 hover:border-blue-400 transition-colors duration-300 ease-in-out ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="file"
        id={id}
        accept=".xlsx, .xls"
        onChange={onFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={processing}
      />
      <div className="text-center">
        <UploadCloud className="mx-auto h-12 w-12 text-gray-500" />
        <p className="mt-2 text-sm text-gray-400">
          <span className="font-medium text-blue-400">Haz clic para subir</span> o arrastra y suelta
        </p>
        <p className="text-xs text-gray-500">Archivos XLS o XLSX</p>
        {fileName && <p className="mt-2 text-xs text-green-400 truncate">Archivo: {fileName}</p>}
      </div>
    </div>
  </div>
);

// Componente para mostrar una tabla de transacciones
const TransactionsTable = ({ title, transactions, comment, onDownload, downloadFileName, isLoading }) => {
  if (!transactions.length && !isLoading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-blue-300 mb-3">{title}</h3>
        <div className="flex items-center text-gray-400">
          <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
          <span>No se encontraron diferencias para esta categoría.</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-blue-300 mb-3">{title}</h3>
        <div className="flex items-center justify-center text-gray-400 py-8">
          <Loader2 className="h-8 w-8 animate-spin mr-3 text-blue-400" />
          <span>Cargando diferencias...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-semibold text-blue-300 mb-3">{title}</h3>
      {comment && <p className="text-sm text-yellow-300 mb-4 italic">{comment}</p>}
      <div className="overflow-x-auto mb-4 max-h-96">
        <table className="min-w-full divide-y divide-gray-700 text-center">
          <thead className="bg-gray-750 sticky top-0 text-center">
            <tr className="text-center items-center" >
              {["Fecha", "Detalle", "Débito", "Crédito"].map(header => (
                <th key={header} scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700 items-center">
            {transactions.map((tx, index) => (
              <tr key={index} className="hover:bg-gray-700 transition-colors text-center items-center">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-center">
                  {tx.fecha ? (tx.fecha instanceof Date ? tx.fecha.toLocaleDateString('es-AR') : String(tx.fecha)) : 'N/A'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 max-w-xs truncate text-center" title={tx.detalle}>{tx.detalle}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-red-400 text-center">{tx.debito?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-green-400 text-center">{tx.credito?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='mb-[25px] mt-[25px]'><br></br></div>
      <button
        class="button"
        onClick={() => onDownload(transactions, downloadFileName)}
        disabled={!transactions.length}
        className="button w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileDown className="h-5 w-5 mr-2" />
        Descargar {downloadFileName}
      </button>
    </div>
  );
};

function App() {
  const [contabilidadFile, setContabilidadFile] = useState(null);
  const [bancoFile, setBancoFile] = useState(null);
  const [contabilidadData, setContabilidadData] = useState([]);
  const [bancoData, setBancoData] = useState([]);
  const [nombreArchivoContabilidad, setNombreArchivoContabilidad] = useState('');
  const [nombreArchivoBanco, setNombreArchivoBanco] = useState('');

  // Faltantes en Contabilidad: Transacciones en banco, no en contabilidad
  const [faltantesEnContabilidad, setFaltantesEnContabilidad] = useState([]);
  // Faltantes en Banco: Transacciones en contabilidad, no en banco
  const [faltantesEnBanco, setFaltantesEnBanco] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);


  // Normaliza las cabeceras y los datos de una transacción
  const normalizeTransaction = useCallback((rawTx) => {
    const tx = { fecha: null, detalle: '', debito: 0, credito: 0, saldo: 0 };
    for (const key in rawTx) {
      if (Object.prototype.hasOwnProperty.call(rawTx, key)) {
        const lowerKey = String(key).toLowerCase().trim();
        const value = rawTx[key];

        if (lowerKey.includes('fecha')) {
          if (value instanceof Date) {
            tx.fecha = value;
          } else if (typeof value === 'number' && XLSX && XLSX.SSF) { // Número de serie de fecha de Excel
            const dateObject = XLSX.SSF.parse_date_code(value);
            if (dateObject) {
              tx.fecha = new Date(dateObject.y, dateObject.m - 1, dateObject.d, dateObject.H || 0, dateObject.M || 0, dateObject.S || 0);
            }
          } else if (typeof value === 'string') {
            const parsedDate = new Date(value); // Intenta parsear strings de fecha comunes
            if (!isNaN(parsedDate.getTime())) {
              tx.fecha = parsedDate;
            }
          }
        } else if (lowerKey === 'detalle' || lowerKey === 'descripcion' || lowerKey === 'descripción') {
          tx.detalle = String(value || '').trim();
        } else if (lowerKey === 'debito' || lowerKey === 'debitos' || lowerKey === 'débito' | lowerKey === 'débitos' ) {
          const numValue = parseFloat(String(value || '0').replace(/[^0-9.,-]/g, '').replace(',', '.'));
          tx.debito = isNaN(numValue) ? 0 : numValue;
        } else if (lowerKey === 'credito' || lowerKey === 'creditos' || lowerKey === 'crédito' || lowerKey === 'créditos' ) {
          const numValue = parseFloat(String(value || '0').replace(/[^0-9.,-]/g, '').replace(',', '.'));
          tx.credito = isNaN(numValue) ? 0 : numValue;
        } else if (lowerKey === 'saldo') {
          const numValue = parseFloat(String(value || '0').replace(/[^0-9.,-]/g, '').replace(',', '.'));
          tx.saldo = isNaN(numValue) ? 0 : numValue;
        }
      }
    }
    return tx;
  }, []);

  // Genera una clave única para una transacción para facilitar la comparación
  const generateTransactionKey = useCallback((tx) => {
    if (!tx || !(tx.fecha instanceof Date) || isNaN(tx.fecha.getTime())) {
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      return `FECHA_INVALIDA_${randomSuffix}|${String(tx.detalle || '').trim().toLowerCase()}|${(tx.debito || 0).toFixed(2)}|${(tx.credito || 0).toFixed(2)}`;
    }
    const year = tx.fecha.getFullYear();
    const month = ('0' + (tx.fecha.getMonth() + 1)).slice(-2);
    const day = ('0' + tx.fecha.getDate()).slice(-2);
    const dateStr = `${year}-${month}-${day}`;
    const detalleStr = String(tx.detalle || '').trim().toLowerCase();
    const debitoStr = (typeof tx.debito === 'number' ? tx.debito : 0).toFixed(2);
    const creditoStr = (typeof tx.credito === 'number' ? tx.credito : 0).toFixed(2);
    return `${dateStr}|${detalleStr}|${debitoStr}|${creditoStr}`;
  }, []);

  // Lee y parsea un archivo Excel
  const readFileData = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!XLSX) {
        reject(new Error("La librería XLSX no está cargada. Asegúrate de incluirla en tu HTML."));
        return;
      }
      if (!file) {
        reject(new Error("No se proporcionó ningún archivo."));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const headerJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval:'' });
          if (headerJson.length === 0) {
            resolve([]);
            return;
          }
          // const headers = headerJson[0].map(h => String(h).toLowerCase().trim()); // No se usa directamente
          
          const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { defval: null });

          const normalizedData = jsonDataRaw.map(row => normalizeTransaction(row));
          resolve(normalizedData);
        } catch (err) {
          console.error("Error al parsear el archivo Excel:", err);
          reject(new Error(`Error al parsear el archivo: ${err.message}`));
        }
      };
      reader.onerror = (err) => {
        console.error("Error del FileReader:", err);
        reject(new Error("Error al leer el archivo."));
      };
      reader.readAsBinaryString(file);
    });
  }, [normalizeTransaction]);


  // Manejador para el cambio de archivo
  const handleFileChange = useCallback(async (event, fileType) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!XLSX) {
        setError("La librería XLSX no está cargada. Por favor, asegúrate de que esté incluida en tu página HTML y recarga.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError('');
    setShowResults(false); 

    try {
      const data = await readFileData(file);
      if (fileType === 'contabilidad') {
        setContabilidadFile(file);
        setNombreArchivoContabilidad(file.name);
        setContabilidadData(data);
      } else {
        setBancoFile(file);
        setNombreArchivoBanco(file.name);
        setBancoData(data);
      }
    } catch (err) {
      setError(err.message || "Error procesando el archivo.");
      if (fileType === 'contabilidad') {
        setContabilidadFile(null);
        setNombreArchivoContabilidad('');
        setContabilidadData([]);
      } else {
        setBancoFile(null);
        setNombreArchivoBanco('');
        setBancoData([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [readFileData]);

  // Realiza la conciliación
  const handleReconcile = useCallback(() => {
    if (!XLSX) {
        setError("La librería XLSX no está cargada. Por favor, asegúrate de que esté incluida en tu página HTML y recarga.");
        return;
    }
    if (!contabilidadFile || !bancoFile) {
      setError("Por favor, suba ambos archivos (Contabilidad y Banco) antes de conciliar.");
      return;
    }
    if (contabilidadData.length === 0 && bancoData.length === 0) {
      setError("Ambos archivos están vacíos o no pudieron ser procesados. Verifique los archivos e inténtelo de nuevo.");
      return;
    }
    if (contabilidadData.length === 0) {
       setError("El archivo de contabilidad está vacío o no pudo ser procesado.");
       return;
    }
    if (bancoData.length === 0) {
       setError("El archivo del banco está vacío o no pudo ser procesado.");
       return;
    }


    setIsLoading(true);
    setError('');
    setFaltantesEnContabilidad([]);
    setFaltantesEnBanco([]);
    setShowResults(true); 

    setTimeout(() => {
      try {
        const contabilidadKeys = new Set(contabilidadData.map(tx => generateTransactionKey(tx)));
        const bancoKeys = new Set(bancoData.map(tx => generateTransactionKey(tx)));

        const newFaltantesEnContabilidad = bancoData.filter(tx => {
          const key = generateTransactionKey(tx);
          return !contabilidadKeys.has(key);
        });

        const newFaltantesEnBanco = contabilidadData.filter(tx => {
          const key = generateTransactionKey(tx);
          return !bancoKeys.has(key);
        });

        setFaltantesEnContabilidad(newFaltantesEnContabilidad);
        setFaltantesEnBanco(newFaltantesEnBanco);

      } catch (e) {
        console.error("Error durante la conciliación:", e);
        setError(`Error durante la conciliación: ${e.message}`);
        setShowResults(false);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  }, [contabilidadFile, bancoFile, contabilidadData, bancoData, generateTransactionKey]);

  // Descarga los datos como un archivo Excel
  const downloadExcel = useCallback((data, filenameBase) => {
    if (!XLSX) {
        setError("La librería XLSX no está cargada. No se puede descargar el archivo.");
        setTimeout(() => setError(''), 3000);
        return;
    }
    if (!data || data.length === 0) {
      setError("No hay datos para descargar.");
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    const exportData = data.map(tx => ({
      'Fecha': tx.fecha ? (tx.fecha instanceof Date ? tx.fecha.toLocaleDateString('es-AR') : String(tx.fecha)) : '',
      'Detalle': tx.detalle,
      'Débito': tx.debito,
      'Crédito': tx.credito,
      'Saldo': tx.saldo 
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Diferencias");
    XLSX.writeFile(workbook, `${filenameBase}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }, []);

  const handleReset = () => {
    setContabilidadFile(null);
    setBancoFile(null);
    setContabilidadData([]);
    setBancoData([]);
    setNombreArchivoContabilidad('');
    setNombreArchivoBanco('');
    setFaltantesEnContabilidad([]);
    setFaltantesEnBanco([]);
    setError('');
    setShowResults(false);
    setIsLoading(false);
    
    const contabilidadInput = document.getElementById('contabilidadFile');
    if (contabilidadInput) contabilidadInput.value = null;
    
    const bancoInput = document.getElementById('bancoFile');
    if (bancoInput) bancoInput.value = null;
  };

  return (
    <div className="min-h-screen flex justify-center w-full p-4 sm:p-8 flex flex-col ">
      <div className="w-full max-w-5xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Conciliación Bancaria
          </h1>
          <p className="mt-3 text-lg text-gray-400">
            Sube tus archivos de contabilidad y extractos bancarios para encontrar las diferencias.
          </p>
          <div className='space-y-1'>
            <div className="bg-gray-800 text-gray-100 max-w-2xl h-40 p-4 rounded-md border border-gray-600 overflow-auto whitespace-pre-line font-sans leading-relaxed mx-auto text-sm">
              IMPORTANTE: En cada archivo, en la fila 1 y columna A - debe tener los siguientes titulos:<br/>
              Fecha, Detalle o Descripción, Débito o Débitos, Crédito o Créditos y Saldo.<br/>
              para poder generar una correcta comparación entre los datos de los archivos.<br/>
            </div>  
          </div>
        <br/><br/>  
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-800 border border-red-700 text-red-200 rounded-lg shadow-lg flex items-center">
            <AlertTriangle className="h-6 w-6 mr-3 text-red-300" />
            <div>
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
             <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-100">
                <XCircle size={20} />
            </button>
          </div>
        )}

        <div className="bg-gray-800 shadow-2xl rounded-xl p-6 sm:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:space-x-4 mb-8 space-y-6">
            <StyledFileInput              
              id="contabilidadFile"
              label="1. Archivo de Contabilidad"
              onFileChange={(e) => handleFileChange(e, 'contabilidad')}
              fileName={nombreArchivoContabilidad}
              processing={isLoading && (contabilidadFile === null || (contabilidadFile && contabilidadFile.name !== nombreArchivoContabilidad))}
            />
            <StyledFileInput              
              id="bancoFile"
              label="2. Archivo del Banco"
              onFileChange={(e) => handleFileChange(e, 'banco')}
              fileName={nombreArchivoBanco}
              processing={isLoading && (bancoFile === null || (bancoFile && bancoFile.name !== nombreArchivoBanco))}
            />
          </div>

          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <button
              class="button"
              onClick={handleReconcile}
              disabled={!contabilidadFile || !bancoFile || isLoading || !XLSX}
              className="button w-full flex-1 px-8 py-4 border border-transparent rounded-lg shadow-md text-lg font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading && !showResults ? (
                <Loader2 className="h-6 w-6 mr-3 animate-spin" />
              ) : (
              <CheckCircle2 className="h-6 w-6 mr-3" />
              )}
              {isLoading && !showResults ? 'Procesando Archivos...' : 'Realizar Conciliación'}
            </button>
            <div className='mb-[20px]'><br></br></div>
            <button
              class="button"
              onClick={handleReset}
              disabled={isLoading}
              className="button w-full sm:w-auto px-6 py-4 border border-gray-600 rounded-lg shadow-md text-lg font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            >
            <RotateCcw className="h-5 w-5 mr-2" />
              Reiniciar
            </button>
          </div>
           {!XLSX && (
            <p className="mt-4 text-xs text-center text-yellow-400">
                Advertencia: La librería XLSX no parece estar cargada. Algunas funcionalidades pueden no estar disponibles.
                Asegúrate de haberla incluido mediante una etiqueta &lt;script&gt; en tu archivo HTML.
            </p>
           )}
        </div>
        
        {showResults && (
          <div className="space-y-8 mt-10 w-full flex flex-col items-center">
            <div className=" max-w-4xl">
              <TransactionsTable                
                title="Valores a ajustar"
                transactions={faltantesEnContabilidad}
                comment="Estas transacciones figuran en el banco, pero no en la contabilidad. Es posible que deban ser registradas."
                onDownload={downloadExcel}
                downloadFileName="Valores_A_Ajustar"
                isLoading={isLoading && faltantesEnContabilidad.length === 0 && faltantesEnBanco.length === 0}
              />
            </div>
            <div className="w-full max-w-4xl">
              <TransactionsTable className="min-w-full"                
                title="Valores pendientes en banco"
                transactions={faltantesEnBanco}
                comment="Estas transacciones figuran en tu contabilidad, pero no en el banco. Podrían ser cheques o transferencias pendientes, o errores."
                onDownload={downloadExcel}
                downloadFileName="Valores_Pendientes_En_Banco"
                isLoading={isLoading && faltantesEnContabilidad.length === 0 && faltantesEnBanco.length === 0}
              />
            </div>
          </div>
        )}
        {showResults && (
          <>
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-blue-600">
                <h4 className="text-lg text-blue-400 font-bold">Items a ajustar</h4>
                <p className="text-2xl text-white mt-2">{faltantesEnContabilidad.length}</p>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-yellow-500">
                <h4 className="text-lg text-yellow-300 font-bold">Items pendientes en banco</h4>
                <p className="text-2xl text-white mt-2">{faltantesEnBanco.length}</p>
              </div>
            </div>

            <div className="space-y-8 mt-4 ">
              {/* ... tus dos tablas ... */}
            </div>
          </>
        )}
         <footer className="mt-12 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Walter Gómez - Fullstack Developer - Data Science </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
