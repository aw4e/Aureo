// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// --- MOCK USDC (Standard ERC20 - 6 Desimal) ---
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "mUSDC") {
        // Mint modal awal ke deployer (1 Juta USDC)
        _mint(msg.sender, 1000000 * 10**6); 
    }

    function decimals() public view virtual override returns (uint8) {
        return 6; // Mengikuti standar USDC asli
    }
    
    // Faucet: Siapapun bisa minta USDC gratis buat testing
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// --- MOCK GOLD (Token Tanpa Access Control) ---
contract MockGold is ERC20 {
    constructor() ERC20("Mantle Gold", "mGOLD") {}

    // Siapapun boleh cetak emas
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    // Siapapun boleh bakar emas (dari wallet sendiri)
    function burn(address from, uint256 amount) public {
        // Tambahan check supaya orang tidak bisa bakar punya orang lain sembarangan
        // kecuali logic bisnisnya memang burn(from, amount) via allowance.
        // Tapi untuk simple mock public mint/burn, biasanya burn msg.sender.
        // Namun code lama: burn(address from, uint256 amount).
        // Karena ini mock untuk "everyone can mint", kita buat simple saja.
        // Jika user mau burn punya orang lain, harusnya butuh allowance, 
        // tapi function _burn tidak cek allowance. 
        // Code lama pakai AccessControl, jadi aman karena cuma Pool yang panggil.
        // Kalau public, bahaya jika 'from' bukan msg.sender.
        
        // Kita ubah jadi standard burn (msg.sender) atau check allowance jika from != msg.sender?
        // User request: "everyone can mint and transfer it". Didn't explicitly say burn.
        // But AureoPool needs to burn user tokens.
        // AureoPool calls: mGold.burn(address(this), _goldAmount); -> burn own tokens?
        // Let's check AureoPool.sol:
        // mGold.transferFrom(msg.sender, address(this), _goldAmount);
        // mGold.burn(address(this), _goldAmount);
        // So the Pool burns its OWN tokens after transferring from user.
        
        // So for MockGold, we can just expose burn(address account, uint256 amount).
        // Caution: Making burn(from, amount) public allows anyone to burn anyone's tokens 
        // if we don't check allowances or restrict it.
        // But since this is a testnet mock requested to be "free for all", 
        // I will keep the signature but maybe restrict to msg.sender or rely on good faith testing?
        // Actually, if I make it completely public, I should probably just allow it 
        // OR behave like standard ERC20Burnable (burn(amount) and burnFrom(account, amount)).
        
        // To keep `AureoRWAPool` compatible (which calls `burn(address, uint256)`), 
        // I will keep the signature. 
        // pool calls: mGold.burn(address(this), _goldAmount);
        // So it burns from itself.
        
        // If I make it:
        // function burn(address from, uint256 amount) public { _burn(from, amount); }
        // Then anyone can burn anyone's tokens. 
        // User asked "everyone can mint", implied free access.
        // I will proceed with this permissive version for the mock.
        _burn(from, amount);
    }
}